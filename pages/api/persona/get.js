// pages/api/persona/get.js — NY
import { getSupabaseServer } from "../../../utils/supabaseServer";
import personaConfig from "../../../config/personaConfig";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Only GET allowed" });
    const botId = (req.query?.botId || "").toString();
    if (!botId) return res.status(400).json({ error: "Missing botId" });

    const supabase = getSupabaseServer();
    // henter evt. override fra DB
    const { data, error } = await supabase
      .from("persona_settings")
      .select("data")
      .eq("bot_id", botId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") { // table or other errors
      return res.status(500).json({ error: String(error.message || error) });
    }

    const defaults = personaConfig?.[botId] || null;
    const override = data?.data || null;
    const result = override || defaults || null;

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
