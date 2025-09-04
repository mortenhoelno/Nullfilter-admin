// FERDIG VERSJON: pages/api/rag/chat.js
// — RAG-endepunkt som tar POST og svarer med mode:"rag"
// — Kjørbar uten Supabase (stub). Hvis Supabase-variabler + RPC finnes, bruker den ekte RAG.
// — Returnerer alltid JSON (aldri HTML), så konsollen slipper "Unexpected token '<'".

import { OpenAI } from "openai";

// ---------- OpenAI klient ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------- (Valgfritt) Supabase klient ----------
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Lazy import to avoid hard dependency hvis du ikke har @supabase/supabase-js installert
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
} catch (err) {
  // Ikke kast feil – RAG skal fortsatt funke i stub-modus
  console.warn("[/api/rag/chat] Supabase init feilet (går i stub-modus):", err?.message);
}

// ---------- Hjelpere ----------
function pickLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function buildSystemPrompt(contextText) {
  const base = [
    "Du er en hjelpsom assistent.",
    "Når du har faktagrunnlag (kontekst) under, prioriter dette. Hvis noe mangler i konteksten, si det ærlig og svar etter beste evne."
  ];
  if (contextText) {
    base.push("Relevant kontekst (ikke gjenta alt, bruk det klokt):");
    base.push(
