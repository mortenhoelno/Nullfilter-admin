// pages/api/chunk-sync.js — FERDIG VERSJON (tilpasset "documents/ai|master/<docId>/fil")
// Node-runtime og Supabase server-klient som i resten av prosjektet

export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
    externalResolver: true,
  },
};

import { parseAndChunk } from "../../utils/chunker";
import { getSupabaseServer } from "../../utils/supabaseServer";
import { storageBucket as STORAGE_BUCKET } from "../../utils/storagePaths"; // 'documents'

const TABLE_CHUNKS = "rag_chunks";
const MAX_FILES_PER_RUN = 100;

// Lister alle filer under gitt "prefix" (f.eks. "ai/" eller "master/")
async function listAllFilesUnderPrefix(supabase, bucket, prefix) {
  async function listDir(path = "") {
    const full = prefix ? (path ? `${prefix}${path}` : prefix) : path;
    const { data, error } = await supabase.storage.from(bucket).list(full, { limit: 1000 });
    if (error) throw error;

    const files = [];
    for (const entry of data || []) {
      const entryPath = full ? `${full}${entry.name}` : entry.name;
      // Katalog? — i Supabase må vi liste videre hvis det ikke ser ut som fil
      const looksLikeDir = !entry.name.includes(".") || entry.id === null;
      if (looksLikeDir) {
        const sub = await listDir(path ? `${path}${entry.name}/` : `${entry.name}/`);
        files.push(...sub);
      } else {
        files.push(entryPath);
      }
    }
    return files;
  }
  return (await listDir("")).filter(Boolean);
}

// Laster ned fil som Buffer
async function downloadFile(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  const arrbuf = await data.arrayBuffer();
  return Buffer.from(arrbuf);
}

// Upsert av chunk-rader
async function upsertChunkRows(supabase, rows) {
  if (!rows.length) return { inserted: 0 };
  const { error } = await supabase.from(TABLE_CHUNKS).upsert(rows, {
    onConflict: "doc_id,chunk_index,source_type",
  });
  if (error) throw error;
  return { inserted: rows.length };
}

// Sjekk om vi allerede har chunks for doc_id + source_type
async function alreadyChunked(supabase, docId, sourceType) {
  const { data, error } = await supabase
    .from(TABLE_CHUNKS)
    .select("id", { count: "exact", head: true })
    .eq("doc_id", docId)
    .eq("source_type", sourceType);
  if (error) throw error;
  return (data && data.length > 0) || false;
}

// Trekker docId fra sti "ai/<docId>/fil" eller "master/<docId>/fil"
function inferDocIdFromPath(p) {
  const m = p.match(/^(?:ai|master)\/(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const supabase = getSupabaseServer(); // bruker SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  const mode = (req.body?.mode || "all").toLowerCase(); // "all" | "new"
  const maxFiles = Math.min(req.body?.limit || MAX_FILES_PER_RUN, 1000);

  try {
    // NB: ditt prosjekt bruker ÉN bucket "documents" med to prefiks
    const [aiPaths, masterPaths] = await Promise.all([
      listAllFilesUnderPrefix(supabase, STORAGE_BUCKET, "ai/"),
      listAllFilesUnderPrefix(supabase, STORAGE_BUCKET, "master/"),
    ]);

    const work = [
      ...aiPaths.map((p) => ({ bucket: STORAGE_BUCKET, path: p, source_type: "ai" })),
      ...masterPaths.map((p) => ({ bucket: STORAGE_BUCKET, path: p, source_type: "master" })),
    ].sort((a, b) => a.path.localeCompare(b.path));

    const results = [];
    let processed = 0;

    for (const item of work) {
      if (processed >= maxFiles) break;

      const docId = inferDocIdFromPath(item.path);
      if (!docId) {
        results.push({ ...item, skipped: true, reason: "Mangler docId i path (forventet ai/<id>/fil eller master/<id>/fil)" });
        continue;
      }

      if (mode === "new") {
        const has = await alreadyChunked(supabase, docId, item.source_type);
        if (has) {
          results.push({ ...item, skipped: true, reason: "Allerede chunket (mode=new)" });
          continue;
        }
      }

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
      bucketInfo: {
        bucket: STORAGE_BUCKET,
        aiCount: aiPaths.length,
        masterCount: masterPaths.length,
      },
      results,
      hint:
        (aiPaths.length + masterPaths.length) === 0
          ? "Fant ingen filer under documents/ai/ og documents/master/. Sjekk at filene ligger som ai/<docId>/<fil> og master/<docId>/<fil> i Supabase Storage."
          : "Bruk mode=new for å hoppe over allerede prosesserte dokumenter.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
