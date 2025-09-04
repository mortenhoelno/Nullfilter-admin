// BYTT UT HELE FILEN MED DENNE
// pages/api/dev/seed-chunks.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    const need = {
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    const missing = Object.entries(need).filter(([,v]) => !v).map(([k]) => k);
    if (missing.length) {
      return res.status(500).json({ ok:false, error:`Mangler env: ${missing.join(", ")}` });
    }
    return res.status(200).json({ ok:true, envOk:true });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}
