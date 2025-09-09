// pages/api/persona/save.js
// Lagrer persona for en bot. Bruker Supabase-tabell 'persona_settings' hvis mulig,
// ellers in-memory fallback (dev). Tabellforventning: persona_settings(bot_id text PK, data jsonb)

import { getSupabaseServer } from "../../../utils/supabaseServer";
import { __PERSONA_MEMORY_STORE__ as MEMORY } from "./get";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Only POST allowed" });

    const { botId, patch } = req.body || {};
    if (!botId || !patch) return res.status(400).json({ ok: false, error: "Missing botId or patch" });

    // 1) Supabase?
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = getSupabaseServer();

      // Upsert
      const { data, error } = await supabase
        .from("persona_settings")
        .upsert({ bot_id: botId, data: patch }, { onConflict: "bot_id" })
        .select("bot_id")
        .maybeSingle();

      if (!error) {
        return res.status(200).json({ ok: true, message: "Lagret i Supabase ✅", botId: data?.bot_id || botId });
      }
    }

    // 2) Fallback – in-memory (dev)
    MEMORY.set(botId, patch);
    return res.status(200).json({ ok: true, message: "Lagret i minnet (dev) ✅", botId });
  } catch (err) {
    console.error("[/api/persona/save] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
