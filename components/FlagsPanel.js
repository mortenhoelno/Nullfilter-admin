// components/FlagsPanel.js — NY
import { useEffect, useState } from "react";
import { useApi } from "../utils/useApi";
import { useToast } from "../utils/toast";

const DEFAULT_FLAGS = [
  { key: "use_token_guard", label: "Bruk Token Guard i chat/RAG", def: true },
  { key: "use_rag_rpc", label: "Bruk RPC for RAG (pgvector)", def: true },
  { key: "crisis_banner", label: "Vis krise-banner i NullFilter", def: false },
  { key: "beta_prompt_studio", label: "Aktiver Prompt-studio", def: true },
  { key: "keeper_mode_light", label: "Keeper: lettvektsmodus", def: false },
];

export default function FlagsPanel() {
  const api = useApi();
  const { toast } = useToast();

  const [flags, setFlags] = useState(() =>
    DEFAULT_FLAGS.reduce((acc, f) => ({ ...acc, [f.key]: f.def }), {})
  );
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get("/api/flags/get");
      // data: { flags: [{key, enabled}] }
      const kv = { ...flags };
      data?.flags?.forEach((f) => {
        kv[f.key] = !!f.enabled;
      });
      setFlags(kv);
    } catch {
      // toast via useApi
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(key, enabled) {
    try {
      await api.post("/api/flags/set", { key, enabled });
      setFlags((prev) => ({ ...prev, [key]: enabled }));
      toast(`Flagg oppdatert: ${key} → ${enabled ? "på" : "av"}`, { type: "success" });
    } catch {
      // toast via useApi
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">🔧 Feature flags</h2>
        <button onClick={load} className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm" disabled={loading}>
          Oppdater
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {DEFAULT_FLAGS.map((f) => (
          <label key={f.key} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">{f.label}</div>
              <div className="text-xs text-gray-500 font-mono">{f.key}</div>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={!!flags[f.key]}
              onChange={(e) => toggle(f.key, e.target.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
