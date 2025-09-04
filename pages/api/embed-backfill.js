// pages/api/embed-backfill.js
// Fyller embedding for rader i rag_chunks der embedding IS NULL

import { createClient } from '@supabase/supabase-js';

const TABLE = 'rag_chunks';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH = 200;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function embedText(input) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI embeddings feilet: ${r.status} ${txt}`);
  }
  const data = await r.json();
  return data.data[0].embedding;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(400).json({ ok: false, error: 'OPENAI_API_KEY mangler' });
    }

    const supabase = serviceClient();
    const q = req.method === 'GET' ? req.query : (req.body || {});
    const limit = Number(q.limit || BATCH);
    const filter_doc_id = q.filter_doc_id ? Number(q.filter_doc_id) : null;
    const filter_source_type = q.filter_source_type || null;

    let db = supabase.from(TABLE)
      .select('id, content')
      .is('embedding', null)
      .limit(limit);

    if (filter_doc_id) db = db.eq('doc_id', filter_doc_id);
    if (filter_source_type) db = db.eq('source_type', filter_source_type);

    const { data: rows, error } = await db;
    if (error) throw error;

    if (!rows || rows.length === 0) {
      return res.status(200).json({ ok: true, updated: 0, note: 'Ingen rader uten embedding 👍' });
    }

    let updated = 0;
    for (const row of rows) {
      const embedding = await embedText(row.content);
      const { error: upErr } = await supabase.from(TABLE).update({ embedding }).eq('id', row.id);
      if (upErr) throw upErr;
      updated++;
    }

    return res.status(200).json({ ok: true, updated });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' }
  }
};
