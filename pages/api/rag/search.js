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
      meta: { sourc
