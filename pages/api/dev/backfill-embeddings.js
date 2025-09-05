// pages/api/dev/backfill-embeddings.js — FERDIG (rag_chunks)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TABLE = "rag_chunks";
const MODEL = "text-embedding-3-small";
const BATCH = 200;

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Mangler SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function embedBatch(texts) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts })
  });
  if (!r.ok) throw new Error(`OpenAI embeddings feilet: ${r.status}`);
  const j = await r.json();
  return j.data.map(d => d.embedding);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    const client = sb();
    const { data: rows, error } = await client
      .from(TABLE)
      .select("id, content")
      .is("embedding", null)
      .limit(BATCH);

    if (error) throw error;
    if (!rows?.length) return res.status(200).json({ ok: true, updated: 0, note: "Ingenting å backfille" });

    const embeddings = await embedBatch(rows.map(r => r.content || ""));
    const updates = rows.map((r, i) => ({ id: r.id, embedding: embeddings[i] }));

    const { error: upErr } = await client.from(TABLE).upsert(updates);
    if (upErr) throw upErr;

    return res.status(200).json({ ok: true, updated: updates.length });
  } catch (err) {
    console.error("[/api/dev/backfill-embeddings] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
