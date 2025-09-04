// pages/api/dev/backfill-embeddings.js
// Oppdaterer public.chunks der embedding er NULL.
// Kjør i små batcher for å unngå timeouts.

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
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts
    })
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

    const batchSize = Number(req.query.batch || 32); // justerbar
    const client = sb();

    // 1) Hent en liten batch uten embedding
    const { data: rows, error: selErr } = await client
      .from("chunks")
      .select("doc_id, chunk_index, content")
      .is("embedding", null)
      .limit(batchSize);

    if (selErr) throw selErr;
    if (!rows || rows.length === 0) {
      return res.status(200).json({ ok: true, updated: 0, done: true });
    }

    // 2) Lag embeddings
    const texts = rows.map(r => String(r.content || ""));
    const embeddings = await embedBatch(texts);

    // 3) Oppdater per rad
    // NB: vi identifiserer rad med (doc_id, chunk_index) som du nå har UNIQUE på.
    const updates = rows.map((r, i) => ({
      doc_id: r.doc_id,
      chunk_index: r.chunk_index,
      embedding: embeddings[i]
    }));

    // Supabase har ikke "bulk update by PK" i én operasjon, så vi kjører én og én:
    for (const u of updates) {
      const { error: upErr } = await client
        .from("chunks")
        .update({ embedding: u.embedding })
        .eq("doc_id", u.doc_id)
        .eq("chunk_index", u.chunk_index);
      if (upErr) throw upErr;
    }

    return res.status(200).json({ ok: true, updated: updates.length, done: false });
  } catch (e) {
    console.error("/api/dev/backfill-embeddings error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
