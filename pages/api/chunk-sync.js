// Fil: pages/api/chunk-sync.js
import fs from "fs/promises";
import path from "path";
import { chunkText } from "@/utils/chunker";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 1536
});

export default async function handler(req, res) {
  const { force = false } = req.query;
  const baseDir = "public/docs";
  const toInsert = [];
  const failed = [];

  try {
    const folders = await fs.readdir(path.join(baseDir, "ai"));
    const docIds = folders.map(f => parseInt(f)).filter(n => !isNaN(n));

    for (const docId of docIds) {
      for (const sourceType of ["ai", "master"]) {
        const docPath = path.join(baseDir, sourceType, String(docId));
        let files;

        try {
          files = await fs.readdir(docPath);
        } catch {
          console.warn(`🚫 Fant ikke katalog for ${sourceType}/${docId}`);
          continue;
        }

        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (![".txt", ".md"].includes(ext)) continue;

          const title = file.replace(ext, "");

          if (!force) {
            // Sjekk om dette dokumentet + sourceType + title er allerede chunket
            const { data, error } = await supabase
              .from("rag_chunks")
              .select("id")
              .eq("doc_id", docId)
              .eq("source_type", sourceType)
              .eq("title", title)
              .limit(1);
            if (data?.length) {
              console.log(`⏩ Hopper over ${sourceType}/${docId}/${file} – allerede chunket`);
              continue;
            }
          }

          try {
            const fullPath = path.join(docPath, file);
            const raw = await fs.readFile(fullPath, "utf-8");
            const chunks = chunkText(raw);
            const embedded = await embeddings.embedDocuments(chunks);

            for (let i = 0; i < chunks.length; i++) {
              toInsert.push({
                doc_id: docId,
                title,
                source_type: sourceType,
                chunk_index: i,
                content: chunks[i],
                token_count: Math.ceil(chunks[i].length / 4),
                embedding: embedded[i],
                created_at: new Date().toISOString()
              });
            }

            console.log(`✅ Chunket ${chunks.length} biter fra ${sourceType}/${docId}/${file}`);
          } catch (err) {
            console.error(`❌ Feil under chunking ${sourceType}/${docId}/${file}`, err);
            failed.push({ doc_id: docId, source_type, file, error: err.message });
          }
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("rag_chunks").insert(toInsert);
      if (error) throw error;
    }

    return res.status(200).json({
      successCount: toInsert.length,
      failedCount: failed.length,
      details: {
        success: toInsert.map(c => ({
          doc_id: c.doc_id,
          source_type: c.source_type,
          chunk_index: c.chunk_index
        })),
        failed
      }
    });
  } catch (err) {
    console.error("Feil under chunking:", err);
    return res.status(500).json({
      successCount: 0,
      failedCount: 1,
      details: {
        success: [],
        failed: [{ error: err.message }]
      }
    });
  }
}
