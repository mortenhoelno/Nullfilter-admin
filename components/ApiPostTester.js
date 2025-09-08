// components/ApiPostTester.js
import { useState } from "react";

export default function ApiPostTester() {
  const [state, setState] = useState({ path: "", loading: false, output: null, error: "" });

  async function run(path) {
    setState({ path, loading: true, output: null, error: "" });
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Du er en hjelpsom assistent." },
            { role: "user", content: "Si hei på norsk." }
          ]
        })
      });
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setState(prev => ({ ...prev, output: json }));
      } catch {
        setState(prev => ({ ...prev, output: txt })); // ikke-JSON
      }
    } catch (e) {
      setState(prev => ({ ...prev, error: String(e?.message || e) }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }

  const testingChat = state.loading && state.path === "/api/chat";
  const testingRag = state.loading && state.path === "/api/rag/chat";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => run("/api/chat")}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
          disabled={state.loading}
        >
          {testingChat ? "Tester…" : "🔎 Test /api/chat (POST)"}
        </button>
        <button
          onClick={() => run("/api/rag/chat")}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
          disabled={state.loading}
        >
          {testingRag ? "Tester…" : "🔎 Test /api/rag/chat (POST)"}
        </button>
      </div>

      {(state.output || state.error) && (
        <div className="w-full mt-2">
          <div className="text-sm font-medium mb-1">
            Resultat for <span className="font-mono">{state.path}</span>
          </div>
          {state.error ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
              Feil: {state.error}
            </div>
          ) : (
            <pre className="text-xs bg-black text-green-300 p-3 rounded-xl overflow-auto max-h-80">
              {typeof state.output === "string" ? state.output : JSON.stringify(state.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
