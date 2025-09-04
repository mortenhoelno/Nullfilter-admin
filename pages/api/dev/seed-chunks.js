// pages/api/dev/seed-chunks.js
// Liten hjelpe-API for å "seed'e" noen biter (chunks) direkte til rag_chunks.
// Bruk KUN i utvikling. Den lager embeddings også, så den funker alene.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Mangler SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function embedBatch(texts) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI embeddings feilet: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j.data.map(d => d.embedding);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    if (!OPENAI_API_KEY) throw new Error("Mangler OPENAI_API_KEY");
    const body = req.body || {};
    const rowsIn = Array.isArray(body.rows) ? body.rows : [];
    if (rowsIn.length === 0) {
      return res.status(400).json({ ok: false, error: "rows[] mangler eller er tom." });
    }

    // Vi bygger chunk_index per doc_id i stigende rekkefølge,
    // og tar med source_type (default 'ai' hvis ikke spesifisert).
    const perDocCounter = new Map();
    const texts = rowsIn.map(r => String(r.content || ""));

    // Lag embeddings i ett kall:
    const embeddings = await embedBatch(texts);

    const outRows = rowsIn.map((r, i) => {
      const docId = Number(r.doc_id);
      if (!perDocCounter.has(docId)) perDocCounter.set(docId, 0);
      const idx = perDocCounter.get(docId);
      perDocCounter.set(docId, idx + 1);

      return {
        doc_id: docId,
        title: r.title || null,
        source_type: r.source_type || "ai", // viktig for filtrering senere
        chunk_index: idx,
        content: String(r.content || ""),
        token_count: Math.ceil(String(r.content || "").length / 4),
        embedding: embeddings[i]
      };
    });

    const client = sb();

    // Upsert på (doc_id, source_type, chunk_index) hvis du har slik unik-index.
    // Hvis unik-index er bare (doc_id, chunk_index), bytt onConflict tilsvarende.
    const { error } = await client
      .from("rag_chunks")
      .upsert(outRows, { onConflict: "doc_id,chunk_index" });

    if (error) throw error;

    return res.status(200).json({ ok: true, inserted: outRows.length });
  } catch (e) {
    console.error("/api/dev/seed-chunks error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
