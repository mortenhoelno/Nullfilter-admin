export default function Dashboard() {
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
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}>
        <h2>Status</h2>
        <ul>
          <li>🟢 Next.js 15.5 kjører</li>
          <li>🧠 Klar for AI-integrasjon</li>
          <li>🗂 Supabase ikke tilkoblet ennå</li>
        </ul>
      </section>
    </main>
  );
}

