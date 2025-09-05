// pages/api/rag/pinned.js — FERDIG (rag_chunks)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  try {
    const body = req.method === "GET" ? req.query : (req.body || {});
    const docId = Number(body.docId ?? 1);
    const limit = Number(body.limit ?? 999);
    const sourceType = body.sourceType ? String(body.sourceType).toLowerCase() : null; // "ai" | "master" | null

    let q = supabase
      .from("rag_chunks")
      .select("doc_id, title, chunk_index, content, source_type")
      .eq("doc_id", docId)
      .order("chunk_index", { ascending: true })
      .limit(limit);

    if (sourceType) q = q.eq("source_type", sourceType);

    const { data, error } = await q;
    if (error) throw error;

    return res.status(200).json({ ok: true, docId, sourceType, chunks: data || [] });
  } catch (err) {
    console.error("[/api/rag/pinned] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
