// pages/api/flags/set.js — NY
import { getSupabaseServer } from "../../../utils/supabaseServer";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

    const { key, enabled } = req.body || {};
    if (!key || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Missing key or enabled" });
    }

    const supabase = getSupabaseServer();

    const { error } = await supabase
      .from("feature_flags")
      .upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) return res.status(500).json({ error: String(error.message || error) });

    // Audit
    await supabase.from("admin_audit_log").insert({
      actor: "dashboard",
      action: "flags.set",
      payload: { key, enabled },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
