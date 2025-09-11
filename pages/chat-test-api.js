// pages/chat-test.js
import { useState } from "react";

export default function ChatApiTest() {
  const [question, setQuestion] = useState("Kan du si hei på norsk?");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [path, setPath] = useState("/api/chat"); // bytt til /api/rag/chat hvis nødvendig
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Du er en hjelpsom assistent." },
            { role: "user", content: question }
          ]
        })
      });
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        if (!res.ok) throw new Error(json?.error || "Ukjent feil");
        setResult(json);
      } catch {
        setError(`Ikke-JSON svar:\n${txt.slice(0, 400)}...`);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">/api chat-test</h1>

        <label className="block text-sm font-medium">API-path</label>
        <input className="w-full border rounded p-2"
               value={path} onChange={e=>setPath(e.target.value)}
               placeholder="/api/chat eller /api/rag/chat" />

        <label className="block text-sm font-medium">Spørsmål</label>
        <input className="w-full border rounded p-2"
               value={question} onChange={e=>setQuestion(e.target.value)} />

        <button onClick={runTest} disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? "Kjører…" : "Send POST"}
        </button>

        {error && <pre className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 whitespace-pre-wrap">{error}</pre>}
        {result && (
          <>
            <div className="p-3 bg-white border rounded">
              <div className="text-sm text-gray-500">Svar</div>
              <div className="whitespace-pre-wrap">{result.reply}</div>
            </div>
            <div className="p-3 bg-white border rounded">
              <div className="text-sm text-gray-500">Debug</div>
              <pre className="text-xs overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
