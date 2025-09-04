// Fil: pages/api/chunk-sync.js
import fs from "fs/promises";
import path from "path";
import { loadAndChunkFromFileSystem } from "../../utils/chunker";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

// 🔐 Supabase-klient
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🤖 OpenAI Embeddings
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 1536,
  openAIApiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  const { force = false } = req.query;
  const toInsert = [];
  const failed = [];

  try {
    // 🔎 Hent docId-er fra AI-mappen
    const baseDir = "public/docs";
    const folders = await fs.readdir(path.join(baseDir, "ai"));
    const docIds = folders.map(f => parseInt(f)).filter(n => !isNaN(n));

    for (const docId of docIds) {
      const chunks = await loadAndChunkFromFileSystem(docId);

      // 🧩 Gruppér chunks per dokument
      const grouped = {};
      for (const c of chunks) {
        const key = `${c.doc_id}|||${c.source_type}|||${c.filename}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
      }

      for (const key in grouped) {
        const [doc_id, source_type, filename] = key.split("|||");
        const title = filename.replace(/\.(txt|md)$/i, "");

        if (!force) {
          const { data, error } = await supabase
            .from("rag_chunks")
            .select("id")
            .eq("doc_id", doc_id)
            .eq("source_type", source_type)
            .eq("title", title)
            .limit(1);
          if (error) throw error;
          if (data?.length) {
            console.log(`⏭️ Hopper over ${source_type}/${doc_id}/${filename} – allerede chunket`);
            continue;
          }
        }

        try {
          const chunkList = grouped[key];
          const texts = chunkList.map(c => c.content);
          const vectors = await embeddings.embedDocuments(texts);

          for (let i = 0; i < chunkList.length; i++) {
            toInsert.push({
              ...chunkList[i],
              embedding: vectors[i],
              title: title,
              created_at: new Date().toISOString()
            });
          }

          console.log(`✅ Chunket ${chunkList.length} biter fra ${source_type}/${doc_id}/${filename}`);
        } catch (err) {
          console.error(`❌ Feil ved embedding av ${source_type}/${doc_id}/${filename}`, err);
          failed.push({ doc_id, source_type, filename, error: err.message });
        }
      }
    }

    // 💾 Skriv til Supabase
    if (toInsert.length > 0) {
      const { error } = await supabase.from("rag_chunks").insert(toInsert);
      if (error) throw error;
    }

    return res.status(200).json({
      successCount: toInsert.length,
      failedCount: failed.length,
      details: { failed }
    });

  } catch (err) {
    console.error("🛑 Kritisk feil under chunking:", err);
    return res.status(500).json({
      successCount: 0,
      failedCount: 1,
      details: {
        failed: [{ error: err.message }]
      }
    });
  }
}
