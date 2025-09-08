// pages/api/flags/get.js — NY
import { getSupabaseServer } from "../../../utils/supabaseServer";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Only GET allowed" });

    const supabase = getSupabaseServer();
    // create table if not exists feature_flags(
    //   key text primary key,
    //   enabled boolean not null default false,
    //   notes text,
    //   updated_at timestamptz default now()
    // );

    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled, notes")
      .order("key", { ascending: true });

    if (error) return res.status(500).json({ error: String(error.message || error) });

    return res.status(200).json({ flags: data || [] });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
