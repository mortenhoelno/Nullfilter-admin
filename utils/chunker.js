// utils/chunker.js  — FERDIG VERSJON
// Robust parser + chunker for PDF/TXT/MD. Fungerer på Vercel Node runtime.
// Viktig: pdf-parse lastes dynamisk KUN for .pdf for å unngå Edge-trøbbel.

function approxTokenCount(str) {
  // ~4 chars per token heuristikk
  return Math.ceil(str.length / 4);
}

export function normalizeText(str) {
  return str
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\u0000/g, "") // fjern null-bytes
    .trim();
}

function safeSliceByTokens(text, maxTokens) {
  // Grov token-bassert slice – holder oss ca. innenfor grenser i embedding
  const approxChars = maxTokens * 4;
  return text.length <= approxChars ? text : text.slice(0, approxChars);
}

/**
 * Del opp tekst i overlappende biter.
 * @param {string} text
 * @param {object} opt
 * @param {number} opt.maxTokens - maks tokens pr chunk (default 400)
 * @param {number} opt.overlapTokens - overlapp (default 80)
 */
export function chunkText(text, opt = {}) {
  const maxTokens = opt.maxTokens ?? 400;
  const overlapTokens = opt.overlapTokens ?? 80;

  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  const approxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  while (start < normalized.length) {
    const end = Math.min(start + approxChars, normalized.length);
    let slice = normalized.slice(start, end);

    // Forsøk å brekke på en pen grense (linjeskift eller punktum) hvis mulig
    if (end < normalized.length) {
      const lastBreak =
        slice.lastIndexOf("\n\n") !== -1
          ? slice.lastIndexOf("\n\n")
          : slice.lastIndexOf(". ");
      if (lastBreak > approxChars * 0.6) {
        slice = slice.slice(0, lastBreak + 1);
      }
    }

    // Sikkerhetskutt mot token-spikes
    slice = safeSliceByTokens(slice, maxTokens);
    chunks.push(slice);

    // Overlapp
    const nextStart = start + slice.length - overlapChars;
    start = Math.max(nextStart, start + 1);
  }

  return chunks.map((content, i) => ({
    index: i,
    content,
    token_estimate: approxTokenCount(content),
  }));
}

/**
 * Parse innhold basert på filtype og returner plaintext.
 * @param {Buffer|Uint8Array} fileBuffer
 * @param {string} filename
 */
export async function extractPlainText(fileBuffer, filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    // Dynamisk import for å unngå Edge/webpack-problemer når PDF ikke trengs
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(fileBuffer);
    return normalizeText(data.text || "");
  }

  // For .txt/.md/.json osv – anta UTF-8
  const decoded = new TextDecoder("utf-8").decode(fileBuffer);
  return normalizeText(decoded);
}

/**
 * Hoved-entry: ta buffer + filnavn, gi tilbake chunks.
 * @param {Buffer|Uint8Array} fileBuffer
 * @param {string} filename
 * @param {object} opt
 */
export async function parseAndChunk(fileBuffer, filename, opt = {}) {
  const text = await extractPlainText(fileBuffer, filename);
  return chunkText(text, opt);
}
