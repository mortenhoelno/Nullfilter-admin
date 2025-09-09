// utils/rag.js — FERDIG VERSJON (DB-kall med detaljert timing)
// Dette modulerer tre ting:
//  1) getDbClient() – enkel klient med .query(action, payload) via HTTP-proxy (DB_HTTP_URL)
//  2) vectorQuery()  – RAG vektorsøk (pgvector) med perf-målinger
//  3) fetchDocsByIds() – Hent valgte chunks + dokumenttittel med perf-målinger
//
// Forventet skjema (tilpass ved behov):
//  - public.documents (id uuid PK, title text, ...)
//  - public.rag_chunks (id bigint PK, doc_id uuid FK → documents.id, title text, content text, embedding vector(1536))
//  - pgvector installert og (anbefalt) IVFFLAT index på rag_chunks(embedding)
//
// Kjøring av RPC via Edge Function:
//  - Sett opp en sikker HTTP-endepunkt (Edge Function) som tar JSON: { action, payload } og returnerer { rows }
//  - Konfigurer env:
//      DB_HTTP_URL    = https://<your-edge-function-url>
//      DB_HTTP_TOKEN  = <bearer token> (f.eks. service role eller egen secret for funksjonen)
//
// NB: Hvis du allerede har en native klient (pg / supabase-js med SQL-proxy), kan du erstatte implementasjonen av query().

import { startPerf } from "./perf";
import personaConfig, { globalPinnedDocId } from "../config/personaConfig";

// --- Enkel cache av klient ---
let cachedDb = null;

/**
 * getDbClient()
 * Returnerer en klient med .query(action, payload) som kaller et internt HTTP-endepunkt.
 * @returns {Promise<{ query: (action: string, payload?: any) => Promise<{ rows: any[] }> }>}
 */
export async function getDbClient() {
  if (cachedDb) return cachedDb;

  let baseUrl = process.env.DB_HTTP_URL;
  let token = process.env.DB_HTTP_TOKEN;

  if (!baseUrl || !token) {
    baseUrl = process.env.SUPABASE_URL;
    token = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!baseUrl || !token) {
    throw new Error(
      "Mangler DB_HTTP_URL/DB_HTTP_TOKEN eller SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Sett env-variablene i Vercel."
    );
  }

  // Minimal HTTP-klient. Nå sender vi { action, payload } til Edge Function.
  const client = {
    async query(action, payload = {}) {
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, payload }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`DB HTTP ${resp.status}: ${txt || "<no body>"}`);
      }
      const json = await resp.json();
      // forventer { rows: [...] }
      if (!json || typeof json !== "object" || !("rows" in json)) {
        throw new Error("Ugyldig DB-svar – forventet { rows: [...] }");
      }
      return json; // { rows }
    },
  };

  cachedDb = client;
  return client;
}

/**
 * vectorQuery()
 * Kjører selve vektorsøket. Nå via RPC `vector_query` i stedet for rå SQL.
 *
 * @param {object} db - klient fra getDbClient()
 * @param {number[]} queryEmbedding - ferdig embedding (float[] fra OpenAI)
 * @param {{ topK?: number, minSim?: number }} options
 * @returns {Promise<{ ids: number[], rows: any[] }>}
 */
export async function vectorQuery(db, queryEmbedding, { topK = 6, minSim = 0.0 } = {}) {
  const perf = startPerf("db_vector_query");
  perf.mark("rpc_send");

  const { rows } = await db.query("vector_query", {
    query_embedding: queryEmbedding,
    topk: topK,
    minsim: minSim,
  });

  perf.measure("rpc_recv", "rpc_send");
  perf.mark("__end");
  const snap = perf.snapshot({ rows: rows.length });
  // console.debug("[DB vectorQuery PERF]", JSON.stringify(snap));

  return {
    ids: rows.map((r) => r.id),
    rows,
  };
}

/**
 * fetchDocsByIds()
 * Henter innholdet for gitte chunk-IDs + dokumenttittel. Nå via RPC `fetch_docs`.
 * @param {object} db
 * @param {number[]} ids
 * @returns {Promise<Array<{ id: number, title: string, content: string }>>}
 */
export async function fetchDocsByIds(db, ids) {
  if (!ids?.length) return [];

  const perf = startPerf("db_fetch_docs");
  perf.mark("rpc_send");

  const { rows } = await db.query("fetch_docs", { ids });

  perf.measure("rpc_recv", "rpc_send");
  perf.mark("__end");
  const snap = perf.snapshot({ rows: rows.length });
  // console.debug("[DB fetchDocsByIds PERF]", JSON.stringify(snap));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
  }));
}

/**
 * fetchPinnedChunks()
 * Henter alle chunks for et gitt dokument-id (uuid).
 * @param {object} db
 * @param {string} docId
 * @returns {Promise<string[]>}
 */
export async function fetchPinnedChunks(db, docId) {
  if (!docId) return [];
  const docs = await fetchDocsByIds(db, [docId]);
  return docs.map((d) => d.content || "");
}

/**
 * getRagContext()
 * Nå utvidet: alltid inkluderer globalPinnedDocId + ev. persona pinnedDocId, i tillegg til vanlige RAG-chunks.
 *
 * @param {object} db
 * @param {number[]} queryEmbedding
 * @param {{ topK?: number, minSim?: number, sourceType?: string, botId?: string }} options
 * @returns {Promise<{ docs: any[], chunks: string[], meta: object }>}
 */
export async function getRagContext(
  db,
  queryEmbedding,
  { topK = 6, minSim = 0.0, sourceType = null, botId = null } = {}
) {
  let allDocs = [];
  let allChunks = [];

  // 1) Global pinned (Mini-Morten)
  if (globalPinnedDocId) {
    const globalDocs = await fetchDocsByIds(db, [globalPinnedDocId]);
    allDocs = [...allDocs, ...globalDocs];
    allChunks = [...allChunks, ...globalDocs.map((d, i) => `### Doc G${i + 1}: ${d.title}\n${d.content}`)];
  }

  // 2) Persona pinned (hvis definert for botId)
  if (botId && personaConfig[botId]?.pinnedDocId) {
    const personaId = personaConfig[botId].pinnedDocId;
    const personaDocs = await fetchDocsByIds(db, [personaId]);
    allDocs = [...allDocs, ...personaDocs];
    allChunks = [...allChunks, ...personaDocs.map((d, i) => `### Doc P${i + 1}: ${d.title}\n${d.content}`)];
  }

  // 3) Dynamiske RAG-chunks
  const { ids } = await vectorQuery(db, queryEmbedding, { topK, minSim, sourceType });
  const ragDocs = await fetchDocsByIds(db, ids);
  allDocs = [...allDocs, ...ragDocs];
  allChunks = [...allChunks, ...ragDocs.map((d, i) => `### Doc R${i + 1}: ${d.title}\n${d.content}`)];

  return {
    docs: allDocs, // alle dokumenter (global + persona + rag)
    chunks: allChunks, // preformatert tekstblokker
    meta: {
      topK,
      returned: ragDocs.length,
      minSim,
      sourceType,
      globalPinned: globalPinnedDocId ? 1 : 0,
      personaPinned: botId && personaConfig[botId]?.pinnedDocId ? 1 : 0,
    },
  };
}
