// ferdig versjon
import { getSupabaseServer } from "../../../utils/supabaseServer";
import { chunkText } from "../../../utils/chunker";
import { embedBatch } from "../../../utils/embeddings";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { docId, title, text, bucket, path, chunkOptions } = req.body || {};
    if (!docId) return res.status(400).json({ error: "docId is required" });

    let sourceText = text;

    // Evt. hent fra Storage hvis path er gitt
    if (!sourceText && bucket && path) {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) return res.status(400).json({ error: "download failed", details: error.message });
      // OBS: vi støtter kun tekstbaserte filer her
      sourceText = await data.text();
    }

    if (!sourceText || !sourceText.trim()) {
      return res.status(400).json({ error: "No text provided (or empty file)" });
    }

    const chunks = chunkText(sourceText, chunkOptions);
    const embeddings = await embedBatch(chunks);

    const supabase = getSupabaseServer();
    const rows = chunks.map((content, i) => ({
      doc_id: docId,
      title: title || null,
      chunk_index: i,
      content,
      token_count: Math.ceil(content.length / 4), // grov estimat
      embedding: embeddings[i]
    }));

    // Upsert i bolker for store dokumenter
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("rag_chunks")
        .upsert(slice, { onConflict: "doc_id,chunk_index" });
      if (error) throw error;
    }

    return res.status(200).json({ ok: true, chunks: rows.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
