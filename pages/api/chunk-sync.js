// pages/api/chunk-sync.js  — FERDIG VERSJON
export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
    externalResolver: true,
  },
};

import { createClient } from "@supabase/supabase-js";
import { parseAndChunk } from "../../utils/chunker";

// --- KONFIG ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sett riktige bucket-navn her
const BUCKET_AI = "docs-ai";
const BUCKET_MASTER = "docs-master";

// Tabell for chunks
const TABLE_CHUNKS = "rag_chunks";

// Hvor mange vi prosesserer pr. run (kan økes)
const MAX_FILES_PER_RUN = 100;

function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase env mangler. Sjekk URL/Service Role.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function listAllFiles(supabase, bucket) {
  // List alle filer i bucketens rot og undermapper
  // NB: Supabase Storage list() må kalles per "directory"; vi bruker en enkel rekursjon.
  async function listDir(path = "") {
    const { data, error } = await supabase.storage.from(bucket).list(path, {
      limit: 1000,
    });
    if (error) throw error;

    const files = [];
    for (const entry of data || []) {
      if (entry.name.endsWith("/")) continue;
      if (entry.id) {
        // ny SDK kan gi id; uansett, bygg path selv
      }
      if (entry.metadata && entry.metadata.mimetype === "application/x-directory") {
        // older style directories
        const sub = await listDir(path ? `${path}/${entry.name}` : entry.name);
        files.push(...sub);
      } else if (entry.name && entry.id === undefined) {
        // Fil
        const fullPath = path ? `${path}/${entry.name}` : entry.name;
        files.push(fullPath);
      }
    }
    return files;
  }
  return listDir("");
}

async function downloadFile(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  const arrbuf = await data.arrayBuffer();
  return Buffer.from(arrbuf);
}

async function upsertChunkRows(supabase, rows) {
  if (!rows.length) return { inserted: 0 };
  const { error } = await supabase.from(TABLE_CHUNKS).upsert(rows, {
    onConflict: "doc_id,chunk_index,source_type",
  });
  if (error) throw error;
  return { inserted: rows.length };
}

async function alreadyChunked(supabase, docId, sourceType) {
  const { data, error } = await supabase
    .from(TABLE_CHUNKS)
    .select("id", { count: "exact", head: true })
    .eq("doc_id", docId)
    .eq("source_type", sourceType);
  if (error) throw error;
  return (data && data.length > 0) || false;
}

function inferDocIdFromPath(p) {
  // Forventer struktur som "49/filnavn.pdf" eller "12/ai.txt"
  const match = p.match(/^(\d+)\//);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const mode = (req.body?.mode || "all").toLowerCase(); // "all" | "new"
  const maxFiles = Math.min(req.body?.limit || MAX_FILES_PER_RUN, 1000);

  const supabase = supabaseAdmin();

  try {
    const [aiPaths, masterPaths] = await Promise.all([
      listAllFiles(supabase, BUCKET_AI),
      listAllFiles(supabase, BUCKET_MASTER),
    ]);

    const work = [];
    for (const p of aiPaths) work.push({ bucket: BUCKET_AI, path: p, source_type: "ai" });
    for (const p of masterPaths) work.push({ bucket: BUCKET_MASTER, path: p, source_type: "master" });

    // Sortér for stabilitet
    work.sort((a, b) => a.path.localeCompare(b.path));

    const results = [];
    let processed = 0;

    for (const item of work) {
      if (processed >= maxFiles) break;

      const docId = inferDocIdFromPath(item.path);
      if (!docId) {
        results.push({ ...item, skipped: true, reason: "Mangler docId i path (forventet NN/fil.pdf)" });
        continue;
      }

      if (mode === "new") {
        const has = await alreadyChunked(supabase, docId, item.source_type);
        if (has) {
          results.push({ ...item, skipped: true, reason: "Allerede chunket (mode=new)" });
          continue;
        }
      }

      // Last ned fil, chunk, og lagre
      const fileBuf = await downloadFile(supabase, item.bucket, item.path);
      const filename = item.path.split("/").pop() || "fil";
      const chunks = await parseAndChunk(fileBuf, filename, {
        maxTokens: 400,
        overlapTokens: 80,
      });

      const rows = chunks.map((c) => ({
        doc_id: docId,
        source_type: item.source_type, // "ai" | "master"
        chunk_index: c.index,
        content: c.content,
        token_estimate: c.token_estimate,
        // embedding fylles inn i ETTERKANT (egen jobb), eller gjør det her hvis du vil
        // embedding: <Float32Array>  (ikke nå)
        source_path: `${item.bucket}/${item.path}`,
      }));

      await upsertChunkRows(supabase, rows);
      results.push({ ...item, ok: true, chunks: rows.length });
      processed += 1;
    }

    res.status(200).json({
      ok: true,
      mode,
      processed,
      totalSeen: work.length,
      maxFiles,
      results,
      hint: "Hvis PDF feiler i bygg: husk Node runtime (denne ruta bruker Node).",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
