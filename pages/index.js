// pages/index.js
// Forside med hurtigknapper, chunk-sync og embed backfill (alt på ett sted)

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("new");
  const [limit, setLimit] = useState(200);
  const [log, setLog] = useState(null);

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return { ok: false, status: res.status, body: await res.text() };
  }

  async function runChunkSync() {
    setLoading(true);
    setLog(null);
    try {
      const r = await fetch("/api/chunk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const j = await safeJson(r);
      setLog(j);
    } catch (e) {
      setLog({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setLoading(true);
    setLog(null);
    try {
      const r = await fetch(`/api/embed-backfill?limit=${encodeURIComponent(String(limit))}`);
      const j = await safeJson(r);
      setLog(j);
    } catch (e) {
      setLog({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Adminpanel</h1>
          <p className="text-gray-600">
            Hurtigtilganger, chunking og test av chat. Nå med leselig skrift og litt glans ✨
          </p>
        </header>

        {/* Hurtigtilgang */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3">🔗 Hurtigtilgang</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/admin" className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500">
              🧰 Dokumentopplasting
            </a>
            <a href="/chat-nullfilter" className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500">
              👉 Null Filter Chat
            </a>
            <a href="/chat-keepertrening" className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-500">
              👉 Keepertrening Chat
            </a>
            <a href="/api/chat" className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90">
              🔎 Test /api/chat nå
            </a>
          </div>
        </section>

        {/* Chunking */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3">🧩 Chunking</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <label className="text-sm">
              Mode:
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="ml-2 border rounded-lg px-3 py-2"
              >
                <option value="new">new (prosesserer kun nye)</option>
                <option value="all">all (prosesserer alt)</option>
              </select>
            </label>
            <button
              onClick={runChunkSync}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-40"
            >
              {loading ? "Kjører…" : "Kjør chunk-sync"}
            </button>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium mb-1">Resultat</div>
            <pre className="text-xs bg-black text-green-300 p-3 rounded-xl overflow-auto max-h-96">
              {log ? JSON.stringify(log, null, 2) : "Ingen kjøring ennå."}
            </pre>
          </div>
        </section>

        {/* Embed backfill */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3">🧠 Embeddings</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <label className="text-sm">
              Backfill limit:
              <input
                type="number"
                min={1}
                value={limit}
                onChange={
