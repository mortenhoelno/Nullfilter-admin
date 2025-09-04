// pages/api/chunk-sync.js — FERDIG VERSJON (med ekstra debug og tydeligere svar)
export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
    externalResolver: true,
  },
};

import { createClient } from "@supabase/supabase-js";
import { parseAndChunk } from "../../utils/chunker";

// --- KONFIG ---
// Tillat å overstyre bucket-navn via env hvis dine heter noe annet.
const BUCKET_AI = process.env.SUPABASE_BUCKET_AI || "docs-ai";
const BUCKET_MASTER = process.env.SUPABASE_BUCKET_MASTER || "docs-master";
const TABLE_CHUNKS = "rag_chunks";
const MAX_FILES_PER_RUN = 100;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase env mangler. Sjekk NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function listAllFiles(supabase, bucket) {
  // Enkel "flate" list – forventer at filene ligger i undermapper som "49/fil.pdf".
  async function listDir(path = "") {
    const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000 });
    if (error) throw error;

    const files = [];
    for (const entry of data || []) {
      // Hvis entry er en "mappe", kall rekursivt
      if (entry.id === null && entry.name && !entry.name.includes(".")) {
        const sub = await listDir(path ? `${path}/${entry.name}` : entry.name);
        files.push(...sub);
      } else {
        const fullPath = path ? `${path}/${entry.name}` : entry.name;
        // Hopp over "skjulte"/tom-noder
        if (fullPath && fullPath.includes("/")) {
          files.push(fullPath);
        }
      }
    }
    return files;
  }
  try {
    const res = await listDir("");
    return res.filter(Boolean);
  } catch (e) {
    // Returner tom + feilhint oppstrøms
    return { __error: String(e) };
  }
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
  const m = p.match(/^(\d+)\//);
  return m ? parseInt(m[1], 10) : null;
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
    const aiList = await listAllFiles(supabase, BUCKET_AI);
    const masterList = await listAllFiles(supabase, BUCKET_MASTER);

    // Håndter feil ved listing
    const listErrors = {};
    if (aiList && aiList.__error) listErrors.ai = aiList.__error;
    if (masterList && masterList.__error) listErrors.master = masterList.__error;

    const aiPaths = Array.isArray(aiList) ? aiList : [];
    const masterPaths = Array.isArray(masterList) ? masterList : [];

    const work = [
      ...aiPaths.map((p) => ({ bucket: BUCKET_AI, path: p, source_type: "ai" })),
      ...masterPaths.map((p) => ({ bucket: BUCKET_MASTER, path: p, source_type: "master" })),
    ].sort((a, b) => a.path.localeCompare(b.path));

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

      const fileBuf = await downloadFile(supabase, item.bucket, item.path);
      const filename = item.path.split("/").pop() || "fil";
      const chunks = await parseAndChunk(fileBuf, filename, {
        maxTokens: 400,
        overlapTokens: 80,
      });

      const rows = chunks.map((c) => ({
        doc_id: docId,
        source_type: item.source_type,
        chunk_index: c.index,
        content: c.content,
        token_estimate: c.token_estimate,
        source_path: `${item.bucket}/${item.path}`,
      }));

      await upsertChunkRows(supabase, rows);
      results.push({ ...item, ok: true, chunks: rows.length });
      processed += 1;
    }

    const payload = {
      ok: true,
      mode,
      processed,
      totalSeen: work.length,
      maxFiles,
      bucketInfo: {
        aiBucket: BUCKET_AI,
        masterBucket: BUCKET_MASTER,
        aiCount: aiPaths.length,
        masterCount: masterPaths.length,
        ...(Object.keys(listErrors).length ? { errors: listErrors } : {}),
      },
      results,
      hint:
        (aiPaths.length + masterPaths.length) === 0
          ? "Fant ingen filer i bucketene. Sjekk: (1) bucket-navn (docs-ai/docs-master) eller sett env SUPABASE_BUCKET_AI/MASTER, (2) at filer ligger under <docId>/filnavn.pdf, (3) at du har lastet opp i Supabase Storage, ikke bare i Git."
          : "Hvis PDF feiler i bygg: husk Node runtime (denne ruta bruker Node).",
    };

    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
