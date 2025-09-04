// pages/index.js — FERDIG OPPDATERT
import { useEffect, useRef, useState } from "react";

export default function Home() {
  // === Eksisterende state (chunk-sync + embeddings) ===
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("new");
  const [limit, setLimit] = useState(500);
  const [log, setLog] = useState(null);

  // Backfill progress state
  const [stats, setStats] = useState({ total: 0, missing: 0 });
  const [autoRunning, setAutoRunning] = useState(false);
  const [processedSoFar, setProcessedSoFar] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [lastRate, setLastRate] = useState(0); // rows per second (smoothed)
  const stopFlag = useRef(false);

  // === Chat/RAG-statistikk (eksisterende) ===
  const [chatStats, setChatStats] = useState(null);
  const [chatStatsErr, setChatStatsErr] = useState("");

  // === NY: RAG snapshot fra /api/rag/status ===
  const [ragStatus, setRagStatus] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragErr, setRagErr] = useState("");

  // === NY: API POST-test (erstatter <a>-lenker som ga 405) ===
  const [apiTest, setApiTest] = useState({
    path: "",
    loading: false,
    output: null,
    error: ""
  });

  function fmtSeconds(s) {
    if (!isFinite(s) || s < 0) return "—";
    const sec = Math.ceil(s);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

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

  async function runBackfillOnce(batch = limit) {
    const t0 = performance.now();
    const r = await fetch(`/api/embed-backfill?limit=${encodeURIComponent(String(batch))}`);
    const j = await safeJson(r);
    const t1 = performance.now();
    const dt = Math.max((t1 - t0) / 1000, 0.001); // s
    if (j && j.ok) {
      const rows = Number(j.updated || 0);
      const rate = rows / dt; // rows per sec
      // Enkel glatting: 70% forrige + 30% ny
      setLastRate(prev => (prev ? prev * 0.7 + rate * 0.3 : rate));
      return rows;
    }
    // Feil - vis i logg og stopp
    setLog(j);
    return -1;
  }

  async function fetchStats() {
    const r = await fetch("/api/embed-stats");
    const j = await safeJson(r);
    if (j && j.ok) {
      setStats({ total: j.total, missing: j.missing });
      return j;
    } else {
      setLog(j);
    }
    return null;
  }

  async function startAutoBackfill() {
    setAutoRunning(true);
    setProcessedSoFar(0);
    setLastRate(0);
    stopFlag.current = false;
    setStartedAt(Date.now());

    const s = await fetchStats();
    if (!s) {
      setAutoRunning(false);
      return;
    }

    let remaining = s.missing;
    while (!stopFlag.current && remaining > 0) {
      const updated = await runBackfillOnce(limit);
      if (updated < 0) break; // error
      setProcessedSoFar(prev => prev + updated);
      remaining -= updated;
      setStats(prev => ({ ...prev, missing: Math.max(remaining, 0) }));
      if (updated === 0) break; // ingenting mer å backfille
    }

    setAutoRunning(false);
  }

  function stopAuto() {
    stopFlag.current = true;
  }

  // === Hent Chat/RAG-statistikk (eksisterende) ===
  async function fetchChatStats() {
    try {
      const res = await fetch("/api/chat-stats");
      const json = await res.json();
      setChatStats(json);
      setChatStatsErr("");
    } catch (e) {
      setChatStatsErr(String(e?.message || e));
    }
  }

  // === NY: Hent RAG snapshot ===
  async function fetchRagStatus() {
    try {
      setRagLoading(true);
      setRagErr("");
      const res = await fetch("/api/rag/status");
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setRagStatus(json);
    } catch (e) {
      setRagErr(String(e?.message || e));
    } finally {
      setRagLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();       // embeddings status
    fetchChatStats();   // chat/RAG status (aggregater)
    fetchRagStatus();   // RAG snapshot (total/ai/master/unique)
  }, []);

  // === NY: POST-testfunksjon for API-knapper ===
  async function runApiTest(path) {
    setApiTest({ path, loading: true, output: null, error: "" });
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
        setApiTest(prev => ({ ...prev, output: json }));
      } catch {
        // Ikke-JSON respons (f.eks. HTML ved serverfeil)
        setApiTest(prev => ({ ...prev, output: txt }));
      }
    } catch (e) {
      setApiTest(prev => ({ ...prev, error: String(e?.message || e) }));
    } finally {
      setApiTest(prev => ({ ...prev, loading: false }));
    }
  }

  // ETA-beregning
  const remaining = stats.missing;
  const rate = lastRate; // rows/sec
  const etaSec = rate > 0 ? remaining / rate : Infinity;
  const elapsedSec = startedAt ? (Date.now() - startedAt) / 1000 : 0;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Adminpanel</h1>
            <p className="text-gray-600">
              Hurtigtilganger, chunking og embeddings. Nå med bever-ETA 🦫⏱️ – og RAG-dashboard!
            </p>
          </div>
          <a
            href="/admin"
            className="mt-1 inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500"
          >
            🗂️ Dokumentoversikt
          </a>
        </header>

        {/* Hurtigtilgang */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3">🔗 Hurtigtilgang</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/chat-nullfilter" className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500">
              👉 Null Filter Chat
            </a>
            <a href="/chat-keepertrening" className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-500">
              👉 Keepertrening Chat
            </a>

            {/* BYTTET fra <a> til POST-knapper */}
            <button
              onClick={() => runApiTest("/api/chat")}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
              disabled={apiTest.loading}
            >
              {apiTest.loading && apiTest.path === "/api/chat" ? "Tester…" : "🔎 Test /api/chat (POST)"}
            </button>

            <button
              onClick={() => runApiTest("/api/rag/chat")}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60"
              disabled={apiTest.loading}
            >
              {apiTest.loading && apiTest.path === "/api/rag/chat" ? "Tester…" : "🔎 Test /api/rag/chat (POST)"}
            </button>
          </div>

          {/* Resultatvisning for API-test */}
          {(apiTest.output || apiTest.error) && (
            <div className="w-full mt-4">
              <div className="text-sm font-medium mb-1">
                Resultat for <span className="font-mono">{apiTest.path}</span>
              </div>
              {apiTest.error ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm">
                  Feil: {apiTest.error}
                </div>
              ) : (
                <pre className="text-xs bg-black text-green-300 p-3 rounded-xl overflow-auto max-h-80">
                  {typeof apiTest.output === "string"
                    ? apiTest.output
                    : JSON.stringify(apiTest.output, null, 2)}
                </pre>
              )}
            </div>
          )}
        </section>

        {/* 📚 NY: RAG snapshot fra /api/rag/status */}
        <section className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">📚 RAG – snapshot</h2>
            <button
              onClick={fetchRagStatus}
              className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
            >
              Oppdater
            </button>
          </div>

          {ragLoading && <div className="text-gray-500">Henter RAG-status…</div>}
          {ragErr && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700">Feil: {ragErr}</div>}

          {ragStatus?.ok && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 border rounded-2xl">
                <div className="text-sm text-gray-500">Totalt antall chunks</div>
                <div className="text-3xl font-bold">{ragStatus.total_chunks}</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-2xl">
                <div className="text-sm text-gray-500">AI-chunks</div>
                <div className="text-3xl font-bold">{ragStatus.ai_chunks}</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-2xl">
                <div className="text-sm text-gray-500">Master-chunks</div>
                <div className="text-3xl font-bold">{ragStatus.master_chunks}</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-2xl">
                <div className="text-sm text-gray-500">Unike dokumenter</div>
                <div className="text-lg font-semibold">
                  AI: {ragStatus.unique_docs?.ai ?? 0} · Master: {ragStatus.unique_docs?.master ?? 0}
                </div>
                <div className="text-sm text-gray-500">Sum: {ragStatus.unique_docs?.total ?? 0}</div>
              </div>
            </div>
          )}
        </section>

        {/* 📊 Chat/RAG-statistikk (eksisterende) */}
        <section className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">📊 Chat/RAG-statistikk</h2>
            <button
              onClick={fetchChatStats}
              className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
            >
              Oppdater
            </button>
          </div>

          {chatStatsErr && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700">
              Feil ved henting av /api/chat-stats: {chatStatsErr}
            </div>
          )}

          {!chatStats && !chatStatsErr && (
            <div className="text-gray-500">Henter RAG/Chat-status…</div>
          )}

          {chatStats && (
            <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-gray-50 border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Topp 10 dokumenter (siste 7 dager)</h3>
                {chatStats.top_docs?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-1 pr-2">Doc ID</th>
                          <th className="py-1 pr-2">Total</th>
                          <th className="py-1 pr-2">AI</th>
                          <th className="py-1 pr-2">Master</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chatStats.top_docs.map((d) => (
                          <tr key={d.doc_id} className="border-b last:border-0">
                            <td className="py-1 pr-2 font-mono">{d.doc_id}</td>
                            <td className="py-1 pr-2">{d.total}</td>
                            <td className="py-1 pr-2">{d.ai}</td>
                            <td className="py-1 pr-2">{d.master}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Ingen data ennå. Still spørsmål i chat for å fylle loggen.</div>
                )}
              </section>

              <section className="bg-gray-50 border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Chunks & Embeddings (snapshot)</h3>
                <ul className="text-sm space-y-1">
                  <li>Total chunks: <span className="font-mono">{chatStats.chunks?.total || 0}</span></li>
                  <li>Med embedding: <span className="font-mono">{chatStats.chunks?.with_embedding || 0}</span></li>
                  <li>AI-chunks: <span className="font-mono">{chatStats.chunks?.by_source?.ai || 0}</span></li>
                  <li>Master-chunks: <span className="font-mono">{chatStats.chunks?.by_source?.master || 0}</span></li>
                </ul>

                <div className="mt-3 text-sm">
                  <div>Modes (siste 7d):</div>
                  <ul className="list-disc pl-5">
                    <li>RAG-kall: <span className="font-mono">{chatStats.modes?.rag || 0}</span></li>
                    <li>Normal: <span className="font-mono">{chatStats.modes?.normal || 0}</span></li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    * “Normal” telles ikke ennå – vi logger primært RAG via <code>rag_usage</code>.
                  </p>
                </div>
              </section>
            </div>
          )}
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

        {/* Embeddings – auto backfill med fremdrift */}
        <section className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3">🧠 Embeddings – Backfill med fremdrift</h2>

          {/* Status/Progress */}
          <div className="grid sm:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-xl bg-gray-100">
              <div className="text-gray-500">Total chunks</div>
              <div className="text-xl font-semibold">{stats.total}</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-100">
              <div className="text-gray-500">Mangler embedding</div>
              <div className="text-xl font-semibold">{stats.missing}</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-100">
              <div className="text-gray-500">Hastighet</div>
              <div className="text-xl font-semibold">{rate ? `${rate.toFixed(1)} r/s` : "—"}</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-100">
              <div className="text-gray-500">ETA</div>
              <div className="text-xl font-semibold">{fmtSeconds(etaSec)}</div>
              <div className="text-xs text-gray-500">Elapset: {fmtSeconds(elapsedSec)}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-3 bg-indigo-500"
                style={{
                  width:
                    stats.total > 0
                      ? `${Math.min(100, ((stats.total - stats.missing) / stats.total) * 100).toFixed(1)}%`
                      : "0%",
                }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {stats.total - stats.missing} / {stats.total} ferdig
            </div>
          </div>

          {/* Kontroller */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm">
                Batch-størrelse:
                <input
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="ml-2 border rounded-lg px-3 py-2 w-28"
                />
              </label>
              <button
                onClick={async () => {
                  const j = await fetchStats();
                  if (!j) return;
                }}
                className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
              >
                Oppdater status
              </button>
            </div>
            <div className="flex items-center gap-3">
              {!autoRunning ? (
                <button
                  onClick={startAutoBackfill}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Start auto-backfill
                </button>
              ) : (
                <button
                  onClick={stopAuto}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500"
                >
                  Stopp
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
