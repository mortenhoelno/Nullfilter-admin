// ferdig versjon
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEFAULT_MODEL = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small"; // 1536-dim

export async function embedBatch(texts, { model = DEFAULT_MODEL } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  // OpenAI håndterer batch i ett kall
  const res = await client.embeddings.create({
    model,
    input: texts
  });
  return res.data.map(d => d.embedding);
}

export async function embedOne(text, { model = DEFAULT_MODEL } = {}) {
  const [emb] = await embedBatch([text], { model });
  return emb;
}
