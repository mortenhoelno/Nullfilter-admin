// pages/api/chunk-sync.js
// FERDIG VERSJON – håndterer doc_number → uuid oppslag før insert i rag_chunks

import { createClient } from '@supabase/supabase-js';
import pdfParse from 'pdf-parse';

const BUCKET = 'documents';
const TABLE = 'rag_chunks';
const DOC_TABLE = 'documents';
const EMBEDDING_MODEL = 'text-embedding-3-small';

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
  return Math.ceil((str || '').length / 4); // grovt: ~4 chars per token
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
    i = end - overlapChars;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function embedTexts(texts) {
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
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return (data || []).filter(f => !f.name.startsWith('.'));
}

async function downloadFile(supabase, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

async function parseContent(blob, filename) {
  const buff = Buffer.from(await blob.arrayBuffer());
  if (filename.toLowerCase().endsWith('.pdf')) {
    const parsed = await pdfParse(buff);
    return parsed.text || '';
  }
  return buff.toString('utf-8');
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
    const mode = (q.mode || 'new').toLowerCase();
    const maxTokens = Number(q.maxTokens || 380);
    const overlapTokens = Number(q.overlapTokens || 40);

    const sources = ['ai', 'master'];
    let processed = 0, skipped = 0, inserted = 0, embedded = 0;
    const logs = [];

    for (const source_type of sources) {
      const roots = await listFiles(supabase, `${source_type}`);
      for (const r of roots) {
        if (!r.name.match(/^\d+$/)) continue; // bare numeriske doc_number
        const doc_number = Number(r.name);

        // 🔑 Slå opp uuid fra documents-tabellen
        const { data: docRows, error: docErr } = await supabase
          .from(DOC_TABLE)
          .select('id')
          .eq('doc_number', doc_number)
          .limit(1);
        if (docErr) throw docErr;
        if (!docRows?.length) {
          logs.push(`Fant ikke dokument med doc_number=${doc_number} i documents-tabellen`);
          continue;
        }
        const doc_id = docRows[0].id; // uuid

        const files = await listFiles(supabase, `${source_type}/${doc_number}`);
        if (!files.length) continue;

        for (const f of files) {
          const source_path = `${source_type}/${doc_number}/${f.name}`;
          const blob = await downloadFile(supabase, source_path);
          const text = await parseContent(blob, f.name);
          if (!text?.trim()) {
            logs.push(`Tom fil: ${source_path}`);
            continue;
          }

          const chunks = chunkText(text, { maxTokens, overlapTokens });
          if (!chunks.length) continue;

          let existingIdx = new Set();
          if (mode === 'new') {
            const { data: existing, error: exErr } = await supabase
              .from(TABLE)
              .select('chunk_index')
              .eq('doc_id', doc_id)
              .eq('source_type', source_type);
            if (exErr) throw exErr;
            (existing || []).forEach(row => existingIdx.add(row.chunk_index));
          }

          for (let i = 0; i < chunks.length; i++) {
            if (mode === 'new' && existingIdx.has(i)) {
              skipped++;
              continue;
            }
            const content = chunks[i];
            const token_estimate = approxTokenLen(content);
            const [embedding] = await embedTexts([content]);

            const { data: up, error: upErr } = await supabase
              .from(TABLE)
              .upsert({
                doc_id, // uuid
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

    return res.status(200).json({
      ok: true,
      mode,
      processed,
      inserted,
      skipped,
      embedded,
      logs
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' }
  }
};
