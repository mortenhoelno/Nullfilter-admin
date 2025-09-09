// components/FeatureFlagsPanel.js
import { useEffect, useState } from "react";

const DEFAULT_FLAGS = {
  enableRag: true,
  useAIAlways: true,
  showDebug: false,
  safeMode: false,
  betaPromptStudio: true,
};

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadFlags() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch("/api/feature-flags");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setFlags({ ...DEFAULT_FLAGS, ...(json?.flags || {}) });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleFlag(key) {
    try {
      setLoading(true);
      setErr("");
      const next = { ...flags, [key]: !flags[key] };
      const res = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: { [key]: next[key] } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setFlags({ ...DEFAULT_FLAGS, ...(json?.flags || {}) });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlags();
  }, []);

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">🧩 Feature flags</h2>
        <button
          onClick={loadFlags}
          className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
        >
          Oppdater
        </button>
      </div>

      {loading && <div className="text-gray-500">Laster…</div>}
      {err && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700">
          Feil: {err}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.keys(flags).map((k) => (
          <label
            key={k}
            className="flex items-center justify-between gap-4 p-3 border rounded-xl"
          >
            <span className="text-sm font-medium">{k}</span>
            <button
              onClick={() => toggleFlag(k)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                flags[k] ? "bg-green-600" : "bg-gray-300"
              }`}
              aria-pressed={flags[k]}
              title={flags[k] ? "På" : "Av"}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  flags[k] ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        * Lagres i minnet på server (volatil) nå. Vi kan peke mot Supabase senere.
      </p>
    </section>
  );
}
