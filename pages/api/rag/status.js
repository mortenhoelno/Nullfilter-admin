// pages/api/rag/status.js — RETTET (bruker select med aggregat, ingen .group())
import { getSupabaseServer } from "../../../utils/supabaseServer";

export default async function handler(_req, res) {
  try {
    const supabase = getSupabaseServer();

    // Total antall chunks
    const { count: total, error: e1 } = await supabase
      .from("rag_chunks")
      .select("id", { count: "exact", head: true });
    if (e1) throw e1;

    // Fordeling per source_type (ai/master) — bruk aggregat i select
    const { data: perType, error: e2 } = await supabase
      .from("rag_chunks")
      .select("source_type, count:id")
      .order("source_type", { ascending: true });
    if (e2) throw e2;

    // Unike dokumenter per type
    const { data: docs, error: e3 } = await supabase
      .from("rag_chunks")
      .select("doc_id, source_type")
      .neq("doc_id", null);
    if (e3) throw e3;

    const aiChunks = perType?.find(r => r.source_type === "ai")?.count ?? 0;
    const masterChunks = perType?.find(r => r.source_type === "master")?.count ?? 0;

    const aiDocs = new Set();
    const masterDocs = new Set();
    for (const r of docs || []) {
      if (r.source_type === "ai") aiDocs.add(r.doc_id);
      if (r.source_type === "master") masterDocs.add(r.doc_id);
    }

    return res.status(200).json({
      ok: true,
      total_chunks: total ?? 0,
      ai_chunks: aiChunks,
      master_chunks: masterChunks,
      unique_docs: {
        ai: aiDocs.size,
        master: masterDocs.size,
        total: aiDocs.size + masterDocs.size
      }
    });
  } catch (err) {
    console.error("[/api/rag/status] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
