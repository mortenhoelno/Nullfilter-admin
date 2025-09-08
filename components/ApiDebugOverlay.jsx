// components/ApiDebugOverlay.jsx
import { useEffect, useRef, useState } from "react";

/**
 * Global overlay som fanger JSON-svar fra /api/chat og /api/rag/chat
 * uten å endre resten av appen. Viser:
 * - mode
 * - used.ai_hits / used.master_hits
 * - siste reply (kort)
 * - antall kall per route
 */
export default function ApiDebugOverlay() {
  const [visible, setVisible] = useState(true);
  const [last, setLast] = useState(null);
  const [counts, setCounts] = useState({ "/api/chat": 0, "/api/rag/chat": 0 });
  const installed = useRef(false);

  useEffect(() => {
    if (installed.current) return;
    installed.current = true;

    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      // Kall original fetch
      const res = await originalFetch(input, init);

      try {
        // Identifiser path (fanger både relative og absolutte URLer)
        const url = typeof input === "string" ? input : (input?.url || "");
        const u = new URL(url, location.origin);
        const isChat = u.pathname === "/api/chat" || u.pathname === "/api/rag/chat";

        // Vi bryr oss bare om POST til chat-endepunkter
        if (isChat && (init?.method || (input?.method))?.toUpperCase() === "POST") {
          // Klon responsen så vi ikke spiser streamen
          const clone = res.clone();
          const text = await clone.text();

          // Prøv å parse JSON
          try {
            const json = JSON.parse(text);
            // Oppdater kall-teller
            setCounts(prev => ({
              ...prev,
              [u.pathname]: (prev[u.pathname] || 0) + 1
            }));
            // Plukk ut felter
            const mode = json?.mode || "unknown";
            const ai_hits = json?.used?.ai_hits ?? 0;
            const master_hits = json?.used?.master_hits ?? 0;
            const reply = typeof json?.reply === "string" ? json.reply : JSON.stringify(json?.reply);

            setLast({
              path: u.pathname,
              mode,
              ai_hits,
              master_hits,
              reply,
              raw: json,
              at: new Date()
            });
          } catch {
            // Ikke-JSON; ignorer
          }
        }
      } catch {
        // Ignorer parsingfeil
      }

      return res;
    };

    return () => {
      // På unmount, gjenopprett fetch (teoretisk – _app unmountes sjelden)
      window.fetch = originalFetch;
    };
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 999999,
          padding: "8px 12px", borderRadius: 12, background: "#111827", color: "white",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)", fontSize: 12
        }}
        title="Vis API debug"
      >
        🪛 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 999999,
        width: 360,
        maxWidth: "90vw",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        boxShadow: "0 12px 30px rgba(0,0,0,0.20)",
        overflow: "hidden",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", background: "#111827", color: "white" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>API Debug</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: 12 }}>
          <div title="/api/chat kall">/api/chat: <b>{counts["/api/chat"] || 0}</b></div>
          <div title="/api/rag/chat kall">/api/rag/chat: <b>{counts["/api/rag/chat"] || 0}</b></div>
          <button
            onClick={() => setVisible(false)}
            style={{ marginLeft: 8, background: "transparent", border: 0, color: "white", opacity: 0.8, cursor: "pointer" }}
            title="Skjul"
          >✕</button>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {last ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ color: "#6b7280" }}>Path</div><div><code>{last.path}</code></div>
              <div style={{ color: "#6b7280" }}>Mode</div><div><code>{last.mode}</code></div>
              <div style={{ color: "#6b7280" }}>AI hits</div><div><code>{last.ai_hits}</code></div>
              <div style={{ color: "#6b7280" }}>Master hits</div><div><code>{last.master_hits}</code></div>
              <div style={{ color: "#6b7280" }}>Tid</div><div>{last.at.toLocaleTimeString()}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Siste reply (trimmet)</div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                  fontSize: 12,
                  background: "#0b1020",
                  color: "#d1fae5",
                  borderRadius: 10,
                  padding: 10,
                  maxHeight: 140,
                  overflow: "auto",
                  whiteSpace: "pre-wrap"
                }}
                title="Dette er svaret fra API-et"
              >
                {String(last.reply).slice(0, 500)}
              </div>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151" }}>Se full JSON</summary>
              <pre
                style={{
                  marginTop: 6,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                  fontSize: 12,
                  background: "#111827",
                  color: "#a7f3d0",
                  borderRadius: 10,
                  padding: 10,
                  maxHeight: 200,
                  overflow: "auto"
                }}
              >
                {JSON.stringify(last.raw, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Kjør en chat i appen, så dukker data opp her 👋
          </div>
        )}
      </div>
    </div>
  );
}
