// utils/rag.js — FERDIG VERSJON (DB-kall med detaljert timing)
// Nå uten globalPinnedDocId (pinned styres fra admin/DB)

import { startPerf } from "./perf";
import personaConfig from "../config/personaConfig";

// --- Enkel cache av klient ---
let cachedDb = null;

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
 * Kjører selve vektorsøket via RPC `vector_query`.
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
  perf.snapshot({ rows: rows.length });

  return {
    ids: rows.map((r) => r.id),
    rows,
  };
}

/**
 * fetchDocsByIds()
 * Henter innholdet for gitte chunk-IDs (bigint).
 */
export async function fetchDocsByIds(db, ids) {
  if (!ids?.length) return [];

  const perf = startPerf("db_fetch_docs");
  perf.mark("rpc_send");

  const { rows } = await db.query("fetch_docs", { ids });

  perf.measure("rpc_recv", "rpc_send");
  perf.mark("__end");
  perf.snapshot({ rows: rows.length });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
  }));
}

/**
 * fetchDocsByDocIds()
 * Henter alle chunks for gitte dokument-id (uuid).
 * Brukes for pinned, med source_type='ai' som default.
 */
export async function fetchDocsByDocIds(db, docIds, wantedSourceType = "ai") {
  if (!docIds?.length) return [];

  const perf = startPerf("db_fetch_docs_by_docid");
  perf.mark("rpc_send");

  const { rows } = await db.query("fetch_docs_by_docid", {
    doc_ids: docIds,
    wanted_source_type: wantedSourceType,
  });

  perf.measure("rpc_recv", "rpc_send");
  perf.mark("__end");
  perf.snapshot({ rows: rows.length });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    source_type: r.source_type,
  }));
}

/**
 * getRagContext()
 * Inkluderer bot-spesifik pinned (fra DB/admin) + dynamiske RAG-chunks.
 */
export async function getRagContext(
  db,
  queryEmbedding,
  { topK = 6, minSim = 0.0, sourceType = null, botId = null } = {}
) {
  let allDocs = [];
  let allChunks = [];

  // 1) Persona pinned (fra admin/DB)
  if (botId && personaConfig[botId]?.pinnedDocId) {
    const personaId = personaConfig[botId].pinnedDocId;
    const personaDocs = await fetchDocsByDocIds(db, [personaId], "ai");
    allDocs.push(...personaDocs);
    allChunks.push(...personaDocs.map((d, i) => `### Doc P${i + 1}: ${d.title}\n${d.content}`));
  }

  // 2) Dynamiske RAG-chunks
  const { ids } = await vectorQuery(db, queryEmbedding, { topK, minSim, sourceType });
  const ragDocs = await fetchDocsByIds(db, ids);
  allDocs.push(...ragDocs);
  allChunks.push(...ragDocs.map((d, i) => `### Doc R${i + 1}: ${d.title}\n${d.content}`));

  return {
    docs: allDocs,
    chunks: allChunks,
    meta: {
      topK,
      returned: ragDocs.length,
      minSim,
      sourceType,
      personaPinned: botId && personaConfig[botId]?.pinnedDocId ? 1 : 0,
    },
  };
}
