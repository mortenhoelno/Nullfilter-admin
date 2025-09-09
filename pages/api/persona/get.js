// pages/api/persona/get.js
// Henter persona for en bot. Prøver Supabase-tabell 'persona_settings' (json per botId).
// Faller tilbake til in-memory hvis Supabase ikke er tilgjengelig.

import personaConfig from "../../../config/personaConfig";
import { getSupabaseServer } from "../../../utils/supabaseServer";

export const config = { runtime: "nodejs" };

// In-memory fallback (overlever ikke cold start)
const MEMORY = new Map(); // key: botId, value: persona patch

export default async function handler(req, res) {
  try {
    const botId = (req.query?.botId || "").toString();
    if (!botId) return res.status(400).json({ ok: false, error: "Missing botId" });

    // 1) In-memory override?
    if (MEMORY.has(botId)) {
      return res.status(200).json({
        ok: true,
        data: MEMORY.get(botId),
        note: "Hentet fra in-memory override.",
      });
    }

    // 2) Supabase?
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("persona_settings")
        .select("bot_id, data")
        .eq("bot_id", botId)
        .maybeSingle();

      if (!error && data?.data) {
        return res.status(200).json({ ok: true, data: data.data });
      }
    }

    // 3) Fallback til personaConfig (read-only)
    const fallback = personaConfig?.[botId] || {};
    return res.status(200).json({
      ok: true,
      data: fallback,
      note: "Supabase ikke funnet / ingen override. Viser personaConfig (read-only).",
    });
  } catch (err) {
    console.error("[/api/persona/get] error:", err);
    return res.status(200).json({
      ok: true,
      data: personaConfig?.[req.query?.botId] || {},
      note: "Feil – viser personaConfig (read-only).",
    });
  }
}

// Eksporter fallback store så /api/persona/save kan gjenbruke (samme prosess).
export { MEMORY as __PERSONA_MEMORY_STORE__ };
