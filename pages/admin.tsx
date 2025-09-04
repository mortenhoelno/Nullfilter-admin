// pages/admin.js
// FERDIG VERSJON: Enkel Tailwind-side som kjører chunk-sync + backfill og viser status.

import { useState } from 'react';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState(null);
  const [mode, setMode] = useState('new');
  const [limit, setLimit] = useState(200);

  async function callChunkSync() {
    setLoading(true);
    setLog(null);
    try {
      const r = await fetch('/api/chunk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const j = await r.json();
      setLog(j);
    } catch (e) {
      setLog({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function callBackfill() {
    setLoading(true);
    setLog(null);
    try {
      const r = await fetch(`/api/embed-backfill?limit=${encodeURIComponent(String(limit))}`);
      const j = await r.json();
      setLog(j);
    } catch (e) {
      setLog({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin – RAG & Embeddings</h1>
          <a href="/" className="text-sm text-blue-600 underline">← Til forsiden</a>
        </header>

        <div className="bg-white shadow rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Chunk-sync modus</div>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="new">new (default) – skip eksisterende</option>
                <option value="all">all – chunk alt på nytt</option>
              </select>
            </div>
            <button
              onClick={callChunkSync}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Kjører…' : 'Kjør chunk + embed'}
            </button>
          </div>

          <hr className="my-2" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Backfill limit</div>
              <input
                type="number"
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 w-28"
              />
            </div>
            <button
              onClick={callBackfill}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {loading ? 'Backfiller…' : 'Embed backfill'}
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-2xl p-5">
          <div className="text-sm font-semibold mb-2">Resultat</div>
          <pre className="text-xs bg-gray-100 p-3 rounded-xl overflow-auto max-h-96">
            {log ? JSON.stringify(log, null, 2) : 'Ingen kjøring enda.'}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Tips: Husk å kjøre SQL for IVFFLAT-indeks og match-funksjonen i Supabase (se instruks lengre ned).
          </p>
        </div>
      </div>
    </div>
  );
}
