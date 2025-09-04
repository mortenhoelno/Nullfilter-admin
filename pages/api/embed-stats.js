// pages/api/embed-stats.js
import { createClient } from '@supabase/supabase-js';

const TABLE = 'rag_chunks';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    const supabase = serviceClient();

    // total
    const { count: total, error: e1 } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true });
    if (e1) throw e1;

    // missing
    const { count: missing, error: e2 } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    if (e2) throw e2;

    res.status(200).json({ ok: true, total: total || 0, missing: missing || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
