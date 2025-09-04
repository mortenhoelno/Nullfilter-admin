// ferdig versjon
export async function getRagContext(query, { topK = 8, filterDocId = null } = {}) {
  const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/rag/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK, filterDocId })
  });
  if (!resp.ok) {
    return { snippets: [], contextText: "" };
  }
  const { matches = [] } = await resp.json();

  const snippets = matches.map((m, i) => ({
    rank: i + 1,
    docId: m.doc_id,
    title: m.title || `Dokument #${m.doc_id}`,
    chunkIndex: m.chunk_index,
    similarity: m.similarity,
    content: m.content
  }));

  const contextText = snippets.map(s =>
    `[${s.rank}] (${s.title} · #${s.docId}/${s.chunkIndex})\n${s.content}`
  ).join(`\n\n---\n\n`);

  return { snippets, contextText };
}
// ⬇️ LEGG TIL: hent hele (eller mesteparten av) ett dokument – f.eks. Dokument 1 (pinned)
export async function getPinnedDocContext(docId = 1, { limit = 999 } = {}) {
  // Egen lettvekts-endepunkt som returnerer chunks i riktig rekkefølge.
  // (Du lager endepunktet i punkt 2 nedenfor.)
  const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/rag/pinned`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, limit })
  });

  if (!resp.ok) {
    return { snippets: [], contextText: "" };
  }
  const { chunks = [] } = await resp.json();

  const snippets = chunks.map((c, i) => ({
    rank: i + 1,
    docId: c.doc_id,
    title: c.title || `Dokument #${c.doc_id}`,
    chunkIndex: c.chunk_index,
    content: c.content
  }));

  const contextText = snippets.map(s =>
    `[PIN ${s.rank}] (${s.title} · #${s.docId}/${s.chunkIndex})\n${s.content}`
  ).join(`\n\n---\n\n`);

  return { snippets, contextText };
}

// ⬇️ LEGG TIL: liten hjelper for å kombinere pinned + rag innenfor et tokenbudsjett
export function buildCombinedContext({ pinnedText = "", ragText = "", pinnedMaxChars = 32000, ragMaxChars = 8000 }) {
  // (enkelt og robust: char-budsjett ~ token/4; vi holder oss rause på GPT-5)
  const pin = pinnedText.length > pinnedMaxChars ? pinnedText.slice(0, pinnedMaxChars) : pinnedText;
  const rag = ragText.length > ragMaxChars ? ragText.slice(0, ragMaxChars) : ragText;

  const blocks = [];
  if (pin) blocks.push("STYRING & PERSONA (Dok 1):\n" + pin);
  if (rag) blocks.push("RELEVANT KUNNSKAP:\n" + rag);

  return blocks.join(`\n\n---\n\n`);
}
