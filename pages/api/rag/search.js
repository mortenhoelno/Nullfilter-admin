// pages/api/rag/search.js — FERDIG VERSJON (peker på rag_chunks)
import { OpenAI } from "openai";

/** ─────────── helpers: headers / CORS / methods ─────────── */
function allow(res) {
  res.setHeader("Allow", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** ─────────── lazy supabase client ─────────── */
let supabase = null;
async function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

/** ─────────── OpenAI client (kun brukt hvis vi vil gjøre embedding-søk senere) ─────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ─────────── core search using Supabase RPC match_rag_chunks (pgvector) ───────────
 * Forventer at du har funksjonen `public.match_rag_chunks` i Supabase (se SQL lenger ned).
 * Hvis den mangler, faller vi automatisk tilbake til enkel tekstsøk (ILIKE) i rag_chunks.
 */
async function vectorSearchWithRPC(query, { topK = 6, minSim = 0.2, sourceType = null } = {}) {
  const sb = await getSupabase();
  if (!sb || !process.env.OPENAI_API_KEY) return { ok: false, reason: "rpc-unavailable" };

  // Lag embedding av spørsmålet
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query
  });
  const query_embedding = emb?.data?.[0]?.embedding;
  if (!Array.isArray(query_embedding)) return { ok: false, reason: "embedding-missing" };

  const { data, error } = await sb.rpc("match_rag_chunks", {
    query_embedding,
    match_threshold: minSim,
    match_count: topK,
    wanted_source_type: sourceType // null, "ai" eller "master"
  });

  if (error) {
    return { ok: false, reason: `rpc-error: ${error.message}` };
  }

  const matches = (data || []).map((row) => ({
    id: row.id,
    doc_id: row.doc_id,
    source_type: row.source_type,
    source_path: row.source_path,
    chunk_index: row.chunk_index,
    similarity: row.similarity,
    content: row.content
  }));

  let ai = 0, master = 0;
  for (const m of matches) {
    if (m.source_type === "ai") ai++;
    else if (m.source_type === "master") master++;
  }

  return {
    ok: true,
    matches,
    counts: { ai, master, total: matches.length },
    meta: { source: "rpc" }
  };
}

/** ─────────── fallback: enkel tekstsøk i rag_chunks (ILIKE) ─────────── */
async function textSearchFallback(q, { topK = 6, sourceType = null } = {}) {
  const sb = await getSupabase();
  if (!sb) {
    return {
      ok: false,
      reason: "Supabase mangler (sett SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
      matches: [],
      counts: { ai: 0, master: 0, total: 0 },
      meta: { source: "stub" },
    };
  }

  let query = sb
    .from("rag_chunks")
    .select("id, doc_id, source_type, source_path, chunk_index, content")
    .ilike("content", `%${q}%`)
    .limit(topK);

  if (sourceType) query = query.eq("source_type", sourceType);

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      reason: `Supabase query feilet: ${error.message}`,
      matches: [],
      counts: { ai: 0, master: 0, total: 0 },
      meta: { source: "supabase" },
    };
  }

  const matches = (data || []).map((row) => ({
    id: row.id,
    doc_id: row.doc_id,
    source_type: (row.source_type || "").toLowerCase(),
    source_path: row.source_path || null,
    chunk_index: row.chunk_index ?? null,
    similarity: null,
    content: row.content || "",
  }));

  let ai = 0, master = 0;
  for (const m of matches) {
    if (m.source_type === "ai") ai++;
    else if (m.source_type === "master") master++;
  }

  return {
    ok: true,
    matches,
    counts: { ai, master, total: matches.length },
    meta: { source: "ilike" },
  };
}

/** ─────────── handler ─────────── */
export default async function handler(req, res) {
  try {
    allow(res);
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Only GET allowed" });
    }

    const q = (req.query?.q || "").toString();
    const topK = Math.max(1, Math.min(50, parseInt(req.query?.topK || "6", 10)));
    const minSim = Math.max(0, Math.min(0.99, Number(req.query?.minSim ?? 0.2)));
    const sourceType = req.query?.sourceType ? String(req.query.sourceType).toLowerCase() : null; // "ai" | "master" | null

    if (!q) {
      return res.status(400).json({ error: "Mangler søkestreng 'q'." });
    }

    // Prøv vektor-RPC først, fall tilbake til ILIKE hvis ikke mulig
    const vec = await vectorSearchWithRPC(q, { topK, minSim, sourceType });
    if (vec.ok) return res.status(200).json(vec);

    const txt = await textSearchFallback(q, { topK, sourceType });
    return res.status(200).json(txt);
  } catch (err) {
    console.error("[/api/rag/search] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
