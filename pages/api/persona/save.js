// pages/api/persona/save.js — NY
import { getSupabaseServer } from "../../../utils/supabaseServer";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });
    const { botId, patch } = req.body || {};
    if (!botId || typeof patch !== "object") {
      return res.status(400).json({ error: "Missing botId or patch" });
    }

    const supabase = getSupabaseServer();

    // Sørg for at tabellen finnes i din DB:
    // create table if not exists persona_settings(
    //   bot_id text primary key,
    //   data jsonb not null,
    //   updated_at timestamptz default now()
    // );

    // Oppdater / upsert
    const { error } = await supabase
      .from("persona_settings")
      .upsert({ bot_id: botId, data: patch, updated_at: new Date().toISOString() }, { onConflict: "bot_id" });

    if (error) return res.status(500).json({ error: String(error.message || error) });

    // Audit logg
    await supabase.from("admin_audit_log").insert({
      actor: "dashboard",
      action: "persona.save",
      payload: { botId, patch },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
