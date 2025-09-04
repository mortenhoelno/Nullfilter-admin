// BYTT UT HELE FILEN MED DENNE
// pages/api/dev/seed-chunks.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    const client = sb();
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ ok:false, error:"rows[] mangler" });

    // lag chunk_index per doc_id
    const counters = new Map();
    const toInsert = rows.map(r => {
      const doc_id = Number(r.doc_id);
      if (!counters.has(doc_id)) counters.set(doc_id, 0);
      const idx = counters.get(doc_id);
      counters.set(doc_id, idx + 1);
      return {
        doc_id,
        source_type: r.source_type || 'ai',
        chunk_index: idx,
        title: r.title || null,
        content: String(r.content || ""),
        token_count: Math.ceil(String(r.content || "").length / 4),
        embedding: null // legges til i steg 4
      };
    });

    const { data, error } = await client.from('chunks').upsert(
      toInsert,
      { onConflict: 'doc_id,chunk_index' }
    );
    if (error) throw error;

    return res.status(200).json({ ok:true, inserted:data?.length ?? toInsert.length });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}
