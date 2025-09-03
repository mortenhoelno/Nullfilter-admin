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
