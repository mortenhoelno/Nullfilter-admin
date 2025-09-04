// pages/api/rag/search.js
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

/** ─────────── OpenAI client ─────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ─────────── core search using supabase rpc match_chunks ─────────── */
async function searchSupabase(query, { topK = 6, minSim = 0.2 } = {}) {
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

  // 1) lag embedding
  const emb = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const vector = emb?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding mislyktes.");
  }

  // 2) kall rpc
  const { data, error } = await sb.rpc("match_chunks", {
    embedding: vector,
    match_count: topK,
    min_cosine_sim: minSim,
  });

  if (error) {
    return {
      ok: false,
      reason: `Supabase RPC 'match_chunks' feilet: ${error.message}`,
      matches: [],
      counts: { ai: 0, master: 0, total: 0 },
      meta: { source: "supabase" },
    };
  }

  const matches = (data || []).map((row) => ({
    doc_id: row.doc_id ?? null,
    source_type: (row.source_type || "").toLowerCase(),
    similarity: typeof row.similarity === "number" ? row.similarity : null,
    content: row.content || row.text || row.chunk || "",
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
    meta: { source: "supabase", topK, minSim },
  };
}

/** ─────────── handler ─────────── */
export default async function handler(req, res) {
  allow(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Støtt GET ?q=… for rask testing og POST { q, topK, minSim }
    let q = "";
    let topK = 6;
    let minSim = 0.2;

    if (req.method === "GET") {
      q = String(req.query.q || "").trim();
      if (req.query.topK) topK = Math.max(1, Number(req.query.topK) || 6);
      if (req.query.minSim) minSim = Math.max(0, Math.min(1, Number(req.query.minSim) || 0.2));
    } else if (req.method === "POST") {
      const body = req.body || {};
      q = String(body.q || body.query || "").trim();
      if (body.topK) topK = Math.max(1, Number(body.topK) || 6);
      if (body.minSim) minSim = Math.max(0, Math.min(1, Number(body.minSim) || 0.2));
    } else {
      return res.status(405).json({ error: "Only POST, GET, OPTIONS allowed at /api/rag/search" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY mangler i miljøvariabler." });
    }

    if (!q) {
      return res.status(400).json({ error: "Mangler søkestreng 'q'." });
    }

    const out = await searchSupabase(q, { topK, minSim });
    // out.ok kan være false hvis supabase mangler eller rpc feiler — returner 200 med forklaring
    return res.status(200).json(out);
  } catch (err) {
    console.error("[/api/rag/search] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
