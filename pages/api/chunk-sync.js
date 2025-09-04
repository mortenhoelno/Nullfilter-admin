// pages/api/chunk-sync.js — FERDIG (documents + ai/ og master/)
// Bruker server-klienten din (getSupabaseServer). Normaliserer source_type til 'ai' | 'master'.

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" }, externalResolver: true },
};

import { parseAndChunk } from "../../utils/chunker";
import { getSupabaseServer } from "../../utils/supabaseServer";
import { storageBucket as DEFAULT_BUCKET } from "../../utils/storagePaths"; // hos deg: 'documents'

const TABLE_CHUNKS = "rag_chunks";
const MAX_FILES_PER_RUN = 100;

// Sett bucket fra utils eller env, fallback 'documents'
const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET || "documents";

// Kun lowercase prefikser
const PREFIXES = ["ai", "master"];

// ---------- helpers ----------
function joinPath(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.replace(/\/+$/, "") + "/" + b.replace(/^\/+/, "");
}

async function listImmediateDirs(supabase, bucket, prefix) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Storage list error @ ${bucket}/${prefix}: ${JSON.stringify(error)}`);
  return (data || [])
    .filter((e) => e && e.name && !e.name.includes("."))
    .map((e) => e.name); // docId som string
}

async function listFilesInDocDir(supabase, bucket, prefix, docDir) {
  const dirPath = joinPath(prefix, docDir); // f.eks. "ai/1" eller "master/50"
  const { data, error } = await supabase.storage.from(bucket).list(dirPath, { limit: 1000 });
  if (error) throw new Error(`Storage list error @ ${bucket}/${dirPath}: ${JSON.stringify(error)}`);

  return (data || [])
    .filter((e) => e && e.name && e.name.includes("."))
    .map((e) => ({
      bucket,
      path: joinPath(dirPath, e.name), // f.eks. "ai/1/fil.pdf"
      source_type: prefix, // 'ai' eller 'master'
    }));
}

async function downloadFile(supabase, bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(`Storage download error @ ${bucket}/${path}: ${JSON.stringify(error)}`);
  const arrbuf = await data.arrayBuffer();
  return Buffer.from(arrbuf);
}

async function upsertChunkRows(supabase, rows) {
  if (!rows.length) return { inserted: 0 };
  const { error } = await supabase.from(TABLE_CHUNKS).upsert(rows, {
    onConflict: "doc_id,chunk_index,source_type",
  });
  if (error) throw new Error(`DB upsert error: ${JSON.stringify(error)}`);
  return { inserted: rows.length };
}

async function alreadyChunked(supabase, docId, sourceType) {
  const { data, error } = await supabase
    .from(TABLE_CHUNKS)
    .select("id", { head: true, count: "exact" })
    .eq("doc_id", docId)
    .eq("source_type", sourceType);
  if (error) throw new Error(`DB select error: ${JSON.stringify(error)}`);
  return (data && data.length > 0) || false;
}

function inferDocIdFromPath(p) {
  // Godtar ai eller master
  const m = p.match(/^(?:ai|master)\/(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
}

// ---------- handler ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const mode = (req.body?.mode || "all").toLowerCase();
  const maxFiles = Math.min(req.body?.limit || MAX_FILES_PER_RUN, 1000);

  try {
    const supabase = getSupabaseServer();

    // 1) Finn docId-mapper under ai/ og master/
    const prefixDirs = {};
    for (const prefix of PREFIXES) {
      prefixDirs[prefix] = await listImmediateDirs(supabase, STORAGE_BUCKET, prefix);
    }

    // 2) List alle filer
    let work = [];
    for (const prefix of PREFIXES) {
      const docDirs = prefixDirs[prefix];
      const filesPerDir = await Promise.all(
        docDirs.map((d) => listFilesInDocDir(supabase, STORAGE_BUCKET, prefix, d))
      );
      work = work.concat(...filesPerDir);
    }

    work.sort((a, b) => a.path.localeCompare(b.path));

    // 3) Prosesser filer
    const results = [];
    let processed = 0;

    for (const item of work) {
      if (processed >= maxFiles) break;

      const docId = inferDocIdFromPath(item.path);
      if (!docId) {
        results.push({ ...item, skipped: true, reason: "Mangler docId i path" });
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
        source_type: item.source_type, // 'ai' | 'master'
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
        aiTopLevelDirs: prefixDirs["ai"]?.length || 0,
        masterTopLevelDirs: prefixDirs["master"]?.length || 0,
      },
      results,
      hint:
        work.length === 0
          ? "Fant ingen filer. Sjekk at filer ligger i Supabase Storage under 'documents/ai/<docId>/<fil>' og 'documents/master/<docId>/<fil>'."
          : "Bruk mode=new for å hoppe over allerede prosesserte dokumenter.",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: {
        message: err?.message || String(err),
        name: err?.name || "Error",
        stack: err?.stack || null,
      },
    });
  }
}
