// pages/api/rag/search.js — FERDIG VERSJON (rag_chunks + RPC + fallback)
// ÉN ting: peker 100% på public.rag_chunks.
// - Prøver Supabase RPC `match_rag_chunks` (vektor), faller tilbake til ILIKE hvis RPC ikke finnes.
// - Bruker utils/supabaseServer for konsistent oppsett.

import { OpenAI } from "openai";
import { getSupabaseServer } from "../../../utils/supabaseServer";

function allow(res) {
  res.setHeader("Allow", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function vectorSearchRPC(q, { topK, minSim, sourceType }) {
  const supabase = getSupabaseServer();

  // 1) lag embedding for spørsmålet
  const emb = await openai.embeddings.create({
    model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
    input: q
  });
  const query_embedding = emb?.data?.[0]?.embedding;
  if (!Array.isArray(query_embedding)) {
    return { ok: false, reason: "embedding-missing", matches: [], counts: { ai: 0, master: 0, total: 0 }, meta: { source: "rpc" } };
  }

  // 2) kall RPC
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding,
    match_threshold: minSim,
    match_count: topK,
    wanted_source_type: sourceType || null
  });

  if (error) {
    return { ok: false, reason: `rpc-error: ${error.message}`, matches: [], counts: { ai: 0, master: 0, total: 0 }, meta: { source: "rpc" } };
    }

  const matches = (data || []).map((row) => ({
    id: row.id,
    doc_id: row.doc_id ?? null,
    source_type: (row.source_type || "").toLowerCase(),
    source_path: row.source_path || null,
    chunk_index: row.chunk_index ?? null,
    similarity: typeof row.similarity === "number" ? row.similarity : null,
    content: row.content || ""
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

async function textSearchFallback(q, { topK, sourceType }) {
  const supabase = getSupabaseServer();

  let query = supabase
    .from("rag_chunks")
    .select("id, doc_id, source_type, source_path, chunk_index, content")
    .ilike("content", `%${q}%`)
    .limit(topK);

  if (sourceType) query = query.eq("source_type", sourceType);

  const { data, error } = await query;
  if (error) {
    return { ok: false, reason: `ilike-error: ${error.message}`, matches: [], counts: { ai: 0, master: 0, total: 0 }, meta: { source: "ilike" } };
  }

  const matches = (data || []).map((row) => ({
    id: row.id,
    doc_id: row.doc_id ?? null,
    source_type: (row.source_type || "").toLowerCase(),
    source_path: row.source_path || null,
    chunk_index: row.chunk_index ?? null,
    similarity: null,
    content: row.content || ""
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
    meta: { source: "ilike" }
  };
}

export default async function handler(req, res) {
  try {
    allow(res);
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Only GET allowed" });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase creds mangler" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY mangler" });
    }

    const q = String(req.query?.q || "");
    if (!q) return res.status(400).json({ error: "Mangler søkestreng 'q'." });

    const topK = Math.max(1, Math.min(50, parseInt(req.query?.topK || "6", 10)));
    const minSim = Math.max(0, Math.min(0.99, Number(req.query?.minSim ?? 0.2)));
    const sourceType = req.query?.sourceType ? String(req.query.sourceType).toLowerCase() : null; // "ai" | "master" | null

    // Prøv RPC først. Hvis det feiler (eller ikke finnes), bruk ILIKE.
    const rpc = await vectorSearchRPC(q, { topK, minSim, sourceType });
    if (rpc.ok) return res.status(200).json(rpc);

    const ilike = await textSearchFallback(q, { topK, sourceType });
    return res.status(200).json(ilike);
  } catch (err) {
    console.error("[/api/rag/search] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
