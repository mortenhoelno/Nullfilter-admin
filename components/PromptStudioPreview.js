// components/PromptStudioPreview.js — LETTVEKTS SANDBOX (uten lagring)
// Eksperimenter med prompt, modell (inkl. gpt-5-mini), temperatur og budsjett.
// Svar vises direkte i panelet.

import { useState } from "react";

const DEFAULTS = {
  systemPrompt:
    "Du er en varm, presis og hjelpsom assistent. Svar kortfattet, men tydelig, på norsk.",
  model: "gpt-4o",
  temperature: 0.2,
  budget: { maxTokens: 8000, replyMax: 1200 },
  userInput: "Forklar kjapt hva tjenesten gjør.",
};

const MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-5-mini", // for eksperimentering – backend validerer/feiler hvis ikke støttet
];

export default function PromptStudioPreview() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULTS.systemPrompt);
  const [model, setModel] = useState(DEFAULTS.model);
  const [temperature, setTemperature] = useState(DEFAULTS.temperature);
  const [budget, setBudget] = useState(DEFAULTS.budget);
  const [userInput, setUserInput] = useState(DEFAULTS.userInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [ragHits, setRagHits] = useState({ ai_hits: 0, master_hits: 0 });

  function updBudget(key, val) {
    setBudget((b) => ({ ...b, [key]: Number(val) || 0 }));
  }

  async function runTest() {
    setLoading(true);
    setError("");
    setReply("");
    setRagHits({ ai_hits: 0, master_hits: 0 });
    try {
      const res = await fetch("/api/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInput },
          ],
          model,
          temperature,
          budget: { maxTokens: budget.maxTokens, replyMax: budget.replyMax },
          topK: 6,
          minSim: 0.2,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setReply(json?.reply || "");
      setRagHits(json?.rag || { ai_hits: 0, master_hits: 0 });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">🧪 Prompt-studio (preview)</h2>
        <button
          onClick={runTest}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 text-sm"
        >
          {loading ? "Kjører…" : "Kjør test"}
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Trygg *sandbox*: påvirker ikke bot-konfig. Bruk denne for raske forsøk (inkl. gpt-5-mini). Svar vises nedenfor.
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">System-prompt</span>
            <textarea
              className="mt-1 w-full border rounded-xl p-3 text-sm min-h-[120px]"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium">Bruker-input</span>
            <textarea
              className="mt-1 w-full border rounded-xl p-3 text-sm min-h-[80px]"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">Modell</span>
              <select
                className="mt-1 w-full border rounded-xl p-2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium">Temperature</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                className="mt-1 w-full border rounded-xl p-2"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">maxTokens</span>
              <input
                type="number"
                className="mt-1 w-full border rounded-xl p-2"
                value={budget.maxTokens}
                onChange={(e) => updBudget("maxTokens", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">replyMax</span>
              <input
                type="number"
                className="mt-1 w-full border rounded-xl p-2"
                value={budget.replyMax}
                onChange={(e) => updBudget("replyMax", e.target.value)}
              />
            </label>
          </div>

          <p className="text-xs text-gray-500">
            * RAG-budsjett (ragMax/pinnedMax) holdes utenfor her – API gjør trimming via Token Guard.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
            Feil: {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-1">Svar</div>
            <pre className="text-sm bg-black text-green-300 p-3 rounded-xl overflow-auto max-h-72 whitespace-pre-wrap">
              {reply || (loading ? "Venter på svar…" : "—")}
            </pre>
          </div>

          <div>
            <div className="text-sm font-medium mb-1">RAG-treff</div>
            <div className="p-3 bg-gray-50 border rounded-xl text-sm">
              <div>AI-chunks: <span className="font-mono">{ragHits.ai_hits}</span></div>
              <div>Master-chunks: <span className="font-mono">{ragHits.master_hits}</span></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              * Output kommer direkte hit. Ingen lagring – bare ren moro 🎈
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
