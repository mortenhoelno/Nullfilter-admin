// pages/api/feature-flags.js
// Minimal in-memory feature flag store for dev. Overlever ikke cold start.
// Senere kan vi bytte backing til Supabase uten å endre klientkoden.

export const config = { runtime: "nodejs" };

// Global (per serverprosess) – funker fint på Vercel i dev/lav trafikk
let FLAGS = {
  enableRag: true,
  useAIAlways: true,
  showDebug: false,
  safeMode: false,
  betaPromptStudio: true,
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, flags: FLAGS });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const incoming = body.flags || {};
      FLAGS = { ...FLAGS, ...incoming };
      return res.status(200).json({ ok: true, flags: FLAGS });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/feature-flags] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
