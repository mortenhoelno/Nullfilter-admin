// BYTT UT HELE FILEN MED DENNE
// pages/api/dev/seed-chunks.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    // Bare bevis på at ruta svarer
    const now = new Date().toISOString();
    const body = req.body ?? {};
    return res.status(200).json({ ok: true, pong: now, echoCount: Array.isArray(body.rows) ? body.rows.length : 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
