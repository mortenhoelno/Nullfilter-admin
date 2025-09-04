// Fil: pages/index.js

import Link from "next/link";

export default function Dashboard() {
  // 🧪 Testfunksjon for /api/chat
  async function testChatApi() {
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
    console.log("🔍 Svar fra /api/chat:", data);
    alert("Svar logget i konsollen ✅");
  }

  return (
    <main style={{
      padding: "2rem",
      fontFamily: "Arial",
      background: "#f9f9f9",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Adminpanel</h1>

      <section style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        marginBottom: "2rem"
      }}>
        <h2>Status</h2>
        <ul>
          <li>🟢 Next.js 15.5 kjører</li>
          <li>🧠 Klar for AI-integrasjon</li>
          <li>🗂 Supabase ikke tilkoblet ennå</li>
        </ul>
      </section>

      <section style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}>
        <h2>🔗 Tilganger</h2>
        <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin">
              <a style={{
                color: "#6b21a8",
                textDecoration: "underline",
                fontSize: "1.1rem"
              }}>
                🛠 Gå til Adminside
              </a>
            </Link>
          </li>
          <li>
            <Link href="/chat-nullfilter">
              <a style={{
                color: "#1d4ed8",
                textDecoration: "underline",
                fontSize: "1.1rem"
              }}>
                👉 Null Filter Chat
              </a>
            </Link>
          </li>
          <li style={{ marginTop: "0.5rem" }}>
            <Link href="/chat-keepertrening">
              <a style={{
                color: "#16a34a",
                textDecoration: "underline",
                fontSize: "1.1rem"
              }}>
                👉 Keepertrening Chat
              </a>
            </Link>
          </li>
          <li style={{ marginTop: "1rem" }}>
            <button
              onClick={testChatApi}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              🔍 Test /api/chat nå
            </button>
          </li>
        </ul>
      </section>
    </main>
  );
}
