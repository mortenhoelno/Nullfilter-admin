// utils/chunker.js

import fs from "fs/promises";
import path from "path";

// 💡 Brukes til overlap
function takeTailByTokens(text, tokens) {
  const approxChars = tokens * 4;
  return text.slice(-approxChars);
}

export function normalizeText(str) {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 🔢 Estimat for tokens basert på tegn (grov tommelfingerregel)
function estimateTokens(str) {
  return Math.ceil(str.length / 4);
}

// ✂️ Selve chunkeren – robust og fleksibel
export function chunkText(
  rawText,
  {
    targetTokens = 800,
    overlapTokens = 120,
    hardMaxTokens = 1100,
    normalize = true
  } = {}
) {
  const text = normalize ? normalizeText(rawText) : rawText;
  if (!text || !text.trim()) return [];

  const paragraphs = text.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);

  const chunks = [];
  let current = '';
  let currentTokens = 0;

  const flush = () => {
    if (!current.trim()) return;
    chunks.push(current.trim());
    current = '';
    currentTokens = 0;
  };

  const pushWithChecks = (piece) => {
    const pieceTokens = estimateTokens(piece);
    if (currentTokens + pieceTokens > targetTokens) {
      const sentences = piece.split(/(?<=[.!?])\s+/).filter(Boolean);
      for (const s of sentences) {
        const sTokens = estimateTokens(s + ' ');
        if (currentTokens + sTokens > hardMaxTokens) {
          const words = s.split(/\s+/);
          for (const w of words) {
            const wPlus = (w + ' ');
            const wTokens = estimateTokens(wPlus);
            if (currentTokens + wTokens > hardMaxTokens) {
              flush();
            }
            current += wPlus;
            currentTokens += wTokens;
          }
        } else if (currentTokens + sTokens > targetTokens) {
          flush();
          current += s + ' ';
          currentTokens += sTokens;
        } else {
          current += s + ' ';
          currentTokens += sTokens;
        }
      }
      return;
    }

    current += piece + '\n\n';
    currentTokens += pieceTokens;
  };

  for (const para of paragraphs) {
    pushWithChecks(para);
  }
  flush();

  if (overlapTokens > 0 && chunks.length > 1) {
    const overlapped = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        overlapped.push(chunks[i]);
        continue;
      }
      const prev = chunks[i - 1];
      const tail = takeTailByTokens(prev, overlapTokens);
      overlapped.push(tail + '\n' + chunks[i]);
    }
    return overlapped;
  }

  return chunks;
}

//
// 📂 Hovedfunksjon: Leser og chunker både ai/ og master/
//
export async function loadAndChunkFromFileSystem(docId, baseDir = "public/docs") {
  const chunks = [];

  const docFolders = ["ai", "master"]; // begge versjoner

  for (const sourceType of docFolders) {
    const dirPath = path.join(baseDir, sourceType, String(docId));
    let files;

    try {
      files = await fs.readdir(dirPath);
    } catch (err) {
      console.warn(`📁 Fant ikke katalog: ${dirPath}`);
      continue;
    }

    for (const filename of files) {
      if (!filename.endsWith(".txt") && !filename.endsWith(".md")) continue;

      const filePath = path.join(dirPath, filename);
      const raw = await fs.readFile(filePath, "utf-8");

      const chunkList = chunkText(raw);
      chunkList.forEach((content, i) => {
        chunks.push({
          doc_id: Number(docId),
          chunk_index: i,
          content,
          token_count: Math.ceil(content.length / 4),
          source_type: sourceType, // ai eller master
          filename,
        });
      });
    }
  }

  return chunks;
}
