// utils/rag.js — OPPDATERT FERDIG VERSJON (DB-kall med detaljert timing)
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
//  - { action: "vector_query", payload: { query_embedding, topk, minsim } }
//  - { action: "fetch_docs", payload: { ids } }
//  - { action: "log_chat", payload: { session_id, role, content, tokens, response_ms } }
//
// NB: Hvis du allerede har en native klient (pg / supabase-js), kan du erstatte implementasjonen av query().

import { startPerf } from "./perf";

// --- Enkel cache av klient ---
let cachedDb = null;

/**
 * getDbClient()
 * Returnerer en klient med .query(action, payload) som kaller Edge Function.
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

  // Minimal HTTP-klient. Bruker Edge Function sql-proxy med action/payload.
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
 * Kjører vektorsøk via RPC `vector_query`.
 *
 * @param {object} db - klient fra getDbClient()
 * @param {number[]} queryEmbedding - ferdig generert embedding (float[] / vector)
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
 * Henter dokument-chunks via RPC `fetch_docs`.
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
 * getRagContext()
 * Sammensatt: kjør vectorQuery + fetchDocsByIds og bygg kontekstdeler.
 */
export async function getRagContext(db, queryEmbedding, { topK = 6, minSim = 0.0, sourceType = null } = {}) {
  const { ids } = await vectorQuery(db, queryEmbedding, { topK, minSim, sourceType });
  const docs = await fetchDocsByIds(db, ids);
  const chunks = docs.map((d, i) => `### Doc ${i + 1}: ${d.title}\n${d.content}`);

  return {
    docs,          // array med { id, title, content }
    chunks,        // preformatert tekstblokker
    meta: { topK, returned: docs.length, minSim, sourceType },
  };
}
