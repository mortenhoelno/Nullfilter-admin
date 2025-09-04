// pages/api/chunk-sync.js
// FERDIG VERSJON (Node API). Kjører chunking + embeddings i ett.
// Default: mode=new (skipper eksisterende doc/source_type/chunk_index)

import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';

const BUCKET = 'documents';
const TABLE = 'rag_chunks';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

// --- ENV ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- Helpers ---
function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function approxTokenLen(str) {
  // grovt: ~4 chars pr token
  return Math.ceil((str || '').length / 4);
}

function chunkText(text, { maxTokens = 380, overlapTokens = 40 } = {}) {
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    const slice = text.slice(i, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    i = end - overlapChars; // overlap
    if (i < 0) i = 0;
  }
  return chunks;
}

async function embedTexts(texts) {
  // batchet, men for enkelhet: en og en (stabilt og trygt)
  const out = [];
  for (const input of texts) {
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
    out.push(data.data[0].embedding);
  }
  return out;
}

async function listFiles(supabase, prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return (data || []).filter(f => !f.name.startsWith('.')); // dropp skjulte
}

async function downloadFile(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data; // Blob
}

async function parseContent(blob, filename) {
  const buff = Buffer.from(await blob.arrayBuffer());
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buff);
    return parsed.text || '';
  }
  // default: tekst
  return buff.toString('utf-8');
}

async function ensureIvfflatIndex(supabase) {
  // Kjører trygg "CREATE INDEX IF NOT EXISTS" via RPC? Nei.
  // Vi logger kun en påminnelse i responsen. Selve SQL må kjøres i Supabase.
  // (Se SQL seksjonen i svaret mitt.)
  return true;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY mangler' });
    }

    const supabase = serviceClient();

    const q = req.method === 'GET' ? req.query : req.body || {};
    const mode = (q.mode || 'new').toLowerCase(); // 'new' | 'all'
    const maxTokens = Number(q.maxTokens || 380);
    const overlapTokens = Number(q.overlapTokens || 40);

    const sources = ['ai', 'master'];
    let processed = 0, skipped = 0, inserted = 0, embedded = 0;
    const logs = [];

    for (const source_type of sources) {
      // Finn alle doc-Id mapper under documents/{source_type}/
      const roots = await listFiles(supabase, `${source_type}`);
      for (const r of roots) {
        if (!r.name.match(/^\d+$/)) continue; // bare numeriske doc_id
        const doc_id = Number(r.name);
        const files = await listFiles(supabase, `${source_type}/${doc_id}`);
        if (!files.length) continue;

        for (const f of files) {
          const source_path = `${source_type}/${doc_id}/${f.name}`;
          // Les fil
          const blob = await downloadFile(supabase, source_path);
          const text = await parseContent(blob, f.name);
          if (!text?.trim()) {
            logs.push(`Tom fil: ${source_path}`);
            continue;
          }

          // Chunk
          const chunks = chunkText(text, { maxTokens, overlapTokens });
          if (!chunks.length) continue;

          // Sjekk hva som finnes hvis mode=new
          let existingIdx = new Set();
          if (mode === 'new') {
            const { data: existing, error: exErr } = await supabase
              .from(TABLE)
              .select('chunk_index')
              .eq('doc_id', doc_id)
              .eq('source_type', source_type)
              .order('chunk_index', { ascending: true });
            if (exErr) throw exErr;
            (existing || []).forEach(row => existingIdx.add(row.chunk_index));
          }

          // For hvert chunk: insert hvis ny, ellers skip
          for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i];
            const token_estimate = approxTokenLen(content);

            const isExisting = existingIdx.has(i);
            if (mode === 'new' && isExisting) {
              skipped++;
              continue;
            }

            // Lag embedding
            const [embedding] = await embedTexts([content]);
            // Insert / upsert
            const { data: up, error: upErr } = await supabase
              .from(TABLE)
              .upsert({
                doc_id,
                source_type,
                chunk_index: i,
                content,
                token_estimate,
                source_path,
                embedding
              }, { onConflict: 'doc_id,source_type,chunk_index' })
              .select('id');
            if (upErr) throw upErr;

            processed++;
            inserted += up?.length ? 1 : 0;
            embedded++;
          }
        }
      }
    }

    await ensureIvfflatIndex(supabase);

    return res.status(200).json({
      ok: true,
      mode,
      processed,
      inserted,
      skipped,
      embedded,
      note: 'Kjør SQL i Supabase for IVFFLAT-indeks og match-funksjonen (se svaret mitt).',
      logs
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// Next.js pages API kjører i Node-miljø by default.
// Ikke spesifiser Edge; pdf-parse trenger Node.
export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' }
  }
};
