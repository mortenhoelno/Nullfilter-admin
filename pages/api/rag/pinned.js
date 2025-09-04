// pages/api/rag/pinned.js  ← NY FIL
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side nøkkel
);

export default async function handler(req, res) {
  try {
    const { docId = 1, limit = 999 } = req.body || {};

    const { data, error } = await supabase
      .from("chunks")
      .select("doc_id, title, chunk_index, content")
      .eq("doc_id", docId)
      .order("is_governance", { ascending: false })
      .order("chunk_index", { ascending: true })
      .limit(limit);

    if (error) throw error;

    res.status(200).json({ ok: true, chunks: data || [] });
  } catch (err) {
    console.error("/api/rag/pinned error", err);
    res.status(500).json({ ok: false, error: err.message, chunks: [] });
  }
}
