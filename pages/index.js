// pages/index.js — FERDIG VERSJON
import { useState } from "react";

export default function AdminIndex() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(null);
  const [mode, setMode] = useState("all"); // "all" | "new"

  async function runChunk() {
    try {
      setBusy(true);
      setLog(null);
      const r = await fetch("/api/chunk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, limit: 100 }),
      });
      const json = await r.json();
      setLog(json);
    } catch (e) {
      setLog({ ok: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Adminpanel</h1>
      <p>
        <a href="/admin">Gå til dokumentopplasting</a>
      </p>

      <div style={{ marginTop: 20, border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
        <h2>Chunking</h2>
        <label>
          Mode:&nbsp;
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">all (prosesser alt)</option>
            <option value="new">new (hopp over allerede chunket)</option>
          </select>
        </label>
        <br />
        <button disabled={busy} onClick={runChunk} style={{ marginTop: 10 }}>
          {busy ? "Chunker…" : "Kjør chunk-sync"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Resultat</h3>
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 400,
          }}
        >
{log ? JSON.stringify(log, null, 2) : "Ingen kjøring ennå."}
        </pre>
      </div>
    </div>
  );
}
