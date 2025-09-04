// pages/index.js — FERDIG VERSJON
import { useState } from "react";

export default function Dashboard() {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("all"); // "all" | "new"
  const [log, setLog] = useState(null);
  const [responseText, setResponseText] = useState(null);

  async function runChunkSync() {
    setBusy(true);
    setLog(null);
    try {
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

  async function testChatApi() {
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: "nullfilter",
          message: "Jeg føler meg helt overveldet og får ikke puste.",
          history: []
        })
      });
      const data = await resp.json();
      setResponseText(data.reply || "Ingen svar mottatt 😕");
    } catch (e) {
      setResponseText("Feil ved kall til /api/chat.");
    }
  }

  const Section = ({ title, children }) => (
    <section style={{
      background: "white",
      padding: "1.25rem",
      borderRadius: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
      marginBottom: "1.25rem",
      border: "1px solid #eee"
    }}>
      <h2 style={{ fontSize: 20, margin: "0 0 0.75rem 0" }}>{title}</h2>
      {children}
    </section>
  );

  const LinkBtn = ({ href, label, color }) => (
    <a
      href={href}
      style={{
        display: "inline-block",
        padding: "0.6rem 1rem",
        background: color || "#111827",
        color: "white",
        textDecoration: "none",
        borderRadius: 8,
        marginRight: 10
      }}
    >
      {label}
    </a>
  );

  return (
    <main style={{
      padding: "2rem",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      background: "#f5f6f8",
      minHeight: "100vh",
      color: "#0b1220",
      fontSize: 16
    }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Adminpanel</h1>
        <p style={{ margin: "6px 0 0 0", color: "#4b5563" }}>
          Hurtigtilganger, chunking og test av chat. Nå med leselig skrift og litt glans ✨
        </p>
      </header>

      <Section title="🔗 Hurtigtilgang">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <LinkBtn href="/admin" label="🛠 Dokumentopplasting" color="#6b21a8" />
          <LinkBtn href="/chat-nullfilter" label="👉 Null Filter Chat" color="#1d4ed8" />
          <LinkBtn href="/chat-keepertrening" label="👉 Keepertrening Chat" color="#16a34a" />
          <button
            onClick={testChatApi}
            style={{
              padding: "0.6rem 1rem",
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            🔍 Test /api/chat nå
          </button>
        </div>

        {responseText && (
          <div style={{
            marginTop: 14,
            padding: "0.9rem",
            background: "#eef2ff",
            borderLeft: "4px solid #4338ca",
            borderRadius: 8
          }}>
            <strong>Svar fra AI:</strong>
            <p style={{ marginTop: 6 }}>{responseText}</p>
          </div>
        )}
      </Section>

      <Section title="🧩 Chunking">
        <label>
          Mode:&nbsp;
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="all">all (prosesser alt)</option>
            <option value="new">new (hopp over allerede chunket)</option>
          </select>
        </label>
        <br />
        <button
          disabled={busy}
          onClick={runChunkSync}
          style={{
            marginTop: 10,
            padding: "0.6rem 1rem",
            background: busy ? "#9ca3af" : "#111827",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: busy ? "not-allowed" : "pointer"
          }}
        >
          {busy ? "Chunker…" : "Kjør chunk-sync"}
        </button>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Resultat</h3>
          <pre style={{
            background: "#0b1220",
            color: "#00ff7b",
            padding: 12,
            borderRadius: 10,
            overflow: "auto",
            maxHeight: 420,
            fontSize: 14
          }}>
{log ? JSON.stringify(log, null, 2) : "Ingen kjøring ennå."}
          </pre>
        </div>
      </Section>
    </main>
  );
}
