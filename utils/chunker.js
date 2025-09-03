// ferdig versjon
// Enkel, robust chunker: avsnitt → setninger → ord, med overlapp.
// Vi holder oss til "ca. tokens" ved å anta ~4 tegn per token.

function estimateTokens(str) {
  // veldig grov estimat, men ok for chunking
  return Math.ceil(str.length / 4);
}

export function chunkText(
  rawText,
  {
    targetTokens = 800,     // ca. 800 tokens per chunk
    overlapTokens = 120,    // ca. 120 tokens overlapp
    hardMaxTokens = 1100,   // sikkerhetstak
    normalize = true
  } = {}
) {
  const text = normalize ? normalizeText(rawText) : rawText;
  if (!text || !text.trim()) return [];

  // Splitt i grove blokker (avsnitt)
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
      // hvis vi vil sprenge target, forsøk å setnings-splitte
      const sentences = piece.split(/(?<=[.!?])\s+/).filter(Boolean);
      for (const s of sentences) {
        const sTokens = estimateTokens(s + ' ');
        if (currentTokens + sTokens > hardMaxTokens) {
          // nødløsning: tvangssplitt på ord
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
          // nær target: flush og start ny
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
    // god plass – sleng inn hele paragrafen
    current += piece + '\n\n';
    currentTokens += pieceTokens;
  };

  for (const para of paragraphs) {
    pushWithChecks(para);
  }
  flush();

  // Legg inn overlapp mellom nabo-chunks
  if (overlapTokens > 0 && chunks.length > 1) {
    const overlapped = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        overlapped.push(chunks[i]);
        continue;
      }
      // hent hale fra forrige
      const prev = chunks[i - 1];
      const tail = takeTailByTokens(prev, overlapTokens);
      overlapped.push(tail + '\n' + chunks[i]);
    }
    return overlapped;
  }

  return chunks;
}

function takeTailByTokens(text, tokens) {
  // grovt: klipp siste N*4 tegn
  const approxChars = tokens * 4;
  return text.slice(-approxChars);
}

export function normalizeText(str) {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \t]+\n/g, '\n') // trim bakerst
    .replace(/\n{3,}/g, '\n\n') // maks to linjeskift
    .trim();
}
