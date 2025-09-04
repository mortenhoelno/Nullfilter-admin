// pages/api/rag/status.js — RETTET
// Enkelt status-endepunkt for RAG: teller fra public.rag_chunks
// - Null-safe (bruker .not('doc_id','is', null))
// - Unngår .group() (ikke støttet i supabase-js)

import { getSupabaseServer } from "../../../utils/supabaseServer";

export default async function handler(_req, res) {
  try {
    const supabase = getSupabaseServer();

    // 1) Total antall chunks
    const { count: total, error: eTotal } = await supabase
      .from("rag_chunks")
      .select("id", { count: "exact", head: true });
    if (eTotal) throw eTotal;

    // 2) Antall pr. type (ai / master) — separate, enkle count-kall
    const [{ count: aiCount, error: eAi }, { count: masterCount, error: eMaster }] = await Promise.all([
      supabase.from("rag_chunks").select("id", { count: "exact", head: true }).eq("source_type", "ai"),
      supabase.from("rag_chunks").select("id", { count: "exact", head: true }).eq("source_type", "master")
    ]);
    if (eAi) throw eAi;
    if (eMaster) throw eMaster;

    // 3) Unike dokumenter pr. type — henter lette rader og deduper i minne
    const { data: docsRows, error: eDocs } = await supabase
      .from("rag_chunks")
      .select("doc_id, source_type")
      .not("doc_id", "is", null); // riktig måte å ekskludere NULL i Supabase-js
    if (eDocs) throw eDocs;

    const aiDocs = new Set();
    const masterDocs = new Set();
    for (const r of docsRows || []) {
      if (r.source_type === "ai") aiDocs.add(r.doc_id);
      if (r.source_type === "master") masterDocs.add(r.doc_id);
    }

    return res.status(200).json({
      ok: true,
      total_chunks: total ?? 0,
      ai_chunks: aiCount ?? 0,
      master_chunks: masterCount ?? 0,
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
