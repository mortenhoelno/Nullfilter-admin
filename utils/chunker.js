// utils/chunker.js — FERDIG VERSJON (rag_chunks)
// - Leser fil (txt/md/pdf), normaliserer og chunker
// - Lagrer til public.rag_chunks med upsert (doc_id, source_type, source_path, chunk_index)
// - Støtter embedding (OpenAI text-embedding-3-small), kan skrus av
// - Utfyller feltene: title, token_estimate, sha256, updated_at (DB-trigger), created_at (default)

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { OpenAI } from "openai";

let supabase = null;
async function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mangler");
  const { createClient } = await import("@supabase/supabase-js");
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ───────── helpers ─────────
function sha256OfString(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function approxTokenCount(str) {
  // grov tommelfinger: ~4 chars per token
  const chars = str?.length ?? 0;
  return Math.ceil(chars / 4);
}

export function normalizeText(str) {
  return (str || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\u0000/g, "") // null-bytes
    .trim();
}

export function simpleChunk(text, { maxTokens = 500, overlapTokens = 50 } = {}) {
  const maxChars = maxTokens * 4;
  const ovlChars = overlapTokens * 4;

  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    const slice = text.slice(i, end).trim();
    if (slice.length > 0) chunks.push(slice);
    if (end >= text.length) break;
    i = end - Math.min(ovlChars, end - i); // overlap
  }
  return chunks;
}

async function readFileSmart(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);
  if (ext === ".pdf") {
    const pdf = await pdfParse(buf);
    return pdf.text || "";
  }
  // default: behandle som tekst
  return buf.toString("utf8");
}

async function embedBatch(texts) {
  if (!process.env.OPENAI_API_KEY) return Array(texts.length).fill(null);
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });
  return resp.data.map(d => d.embedding ?? null);
}

// ───────── hoved-API ─────────

/**
 * Ingest en enkelt fil:
 * - filePath: absolutt eller relativ path i serverens filsystem
 * - docId: nummeret i ditt system (1..N)
 * - sourceType: "ai" | "master"
 * - title: visningsnavn/tittel du ønsker på dokumentet (lagres i tabellen)
 * - generateEmbeddings: true for å fylle "embedding" (vector(1536))
 */
export async function ingestFileToRag({
  filePath,
  docId,
  sourceType,
  title = null,
  generateEmbeddings = true,
  maxTokens = 500,
  overlapTokens = 50
}) {
  if (!filePath || typeof filePath !== "string") throw new Error("filePath mangler");
  if (!docId && docId !== 0) throw new Error("docId mangler");
  if (!["ai", "master"].includes((sourceType || "").toLowerCase())) {
    throw new Error('sourceType må være "ai" eller "master"');
  }

  const sb = await getSupabase();

  // 1) Les + normaliser
  const raw = await readFileSmart(filePath);
  const text = normalizeText(raw);

  // 2) Chunk
  const parts = simpleChunk(text, { maxTokens, overlapTokens });

  // 3) Embeddings (valgfritt)
  let embeddings = Array(parts.length).fill(null);
  if (generateEmbeddings && parts.length > 0) {
    embeddings = await embedBatch(parts);
  }

  // 4) Skriv til DB (upsert per chunk_index)
  const rows = parts.map((content, idx) => ({
    doc_id: Number(docId),
    source_type: sourceType.toLowerCase(),
    source_path: filePath,
    chunk_index: idx,
    content,
    token_count: approxTokenCount(content),
    token_estimate: approxTokenCount(content), // kolonne finnes hos deg
    title: title ?? path.basename(filePath),
    sha256: sha256OfString(content),
    embedding: embeddings[idx] ?? null
    // created_at: default (DB)
    // updated_at: settes av trigger (SQL nedenfor)
  }));

  const { error } = await sb
    .from("rag_chunks")
    .upsert(rows, { onConflict: "doc_id,source_type,source_path,chunk_index" });

  if (error) throw new Error(`Supabase upsert feilet: ${error.message}`);

  return { ok: true, chunks: rows.length, docId, sourceType, filePath };
}

/**
 * Ingest flere filer på rappen.
 */
export async function ingestMany(files, options = {}) {
  const out = [];
  for (const f of files) {
    // f: { filePath, docId, sourceType, title? }
    const r = await ingestFileToRag({ ...f, ...options });
    out.push(r);
  }
  return { ok: true, results: out };
}
