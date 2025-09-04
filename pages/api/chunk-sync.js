// pages/api/chunk-sync.js

import { loadAndChunkFromFileSystem } from "@/utils/chunker";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { docId } = req.body;
  if (!docId) {
    return res.status(400).json({ error: "docId mangler" });
  }

  try {
    const chunks = await loadAndChunkFromFileSystem(docId);

    if (!chunks.length) {
      return res.status(404).json({ error: "Ingen chunks funnet" });
    }

    // Slett gamle chunks for denne docId før vi lagrer nye
    await supabase
      .from("rag_chunks")
      .delete()
      .eq("doc_id", docId);

    // Lag embeddings og last opp i bolker
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.content);
      const vectors = await embeddings.embedDocuments(texts);

      const toInsert = batch.map((c, j) => ({
        doc_id: c.doc_id,
        chunk_index: c.chunk_index,
        content: c.content,
        token_count: c.token_count,
        source_type: c.source_type,
        filename: c.filename,
        embedding: vectors[j]
      }));

      await supabase.from("rag_chunks").insert(toInsert);
    }

    return res.status(200).json({ status: "ok", chunks: chunks.length });
  } catch (err) {
    console.error("Feil under chunking:", err);
    return res.status(500).json({ error: "Intern feil under chunking" });
  }
}
