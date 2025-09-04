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
    base.push("---");
    base.push(contextText);
    base.push("---");
  }
  return base.join("\n");
}

// ---------- RAG: stub (alltid tilgjengelig) ----------
async function retrieveRagContextStub(_query) {
  return {
    contextText: "",
    ai_hits: 0,
    master_hits: 0
  };
}

// ---------- RAG: ekte (Supabase + RPC "match_chunks") ----------
async function retrieveRagContextSupabase(query, { topK = 6 } = {}) {
  if (!supabase || !process.env.OPENAI_API_KEY) {
    return retrieveRagContextStub(query);
  }

  try {
    // 1) Lag embedding av bruker-spørsmål
    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query
    });
    const vector = embeddingResp?.data?.[0]?.embedding;
    if (!Array.isArray(vector)) {
      throw new Error("Embedding mangler eller har feil format");
    }

    // 2) Kall RPC i Supabase for å hente best matchende chunks
    // Forventet RPC-signatur (vanlig praksis):
    //   match_chunks(embedding vector(1536), match_count int, min_cosine_sim float)
    // Output minst: content, source_type, doc_id, similarity
    const { data, error } = await supabase.rpc("match_chunks", {
      embedding: vector,
      match_count: topK,
      min_cosine_sim: 0.2 // juster etter behov
    });

    if (error) {
      console.warn("[/api/rag/chat] Supabase RPC 'match_chunks' feilet:", error.message);
      return retrieveRagContextStub(query);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return retrieveRagContextStub(query);
    }

    // 3) Sett sammen kontekst og treff-statistikk
    let ai_hits = 0;
    let master_hits = 0;
    const parts = [];
    for (const row of data) {
      const chunkText = row.content || row.text || row.chunk || "";
      const src = (row.source_type || "").toLowerCase();
      if (src === "ai") ai_hits++;
      else if (src === "master") master_hits++;
      // Legg på en kort markør for kilde i konteksten (valgfritt)
      parts.push(chunkText);
    }

    const contextText = parts.join("\n\n");
    return { contextText, ai_hits, master_hits };
  } catch (err) {
    console.warn("[/api/rag/chat] retrieveRagContextSupabase error:", err?.message);
    return retrieveRagContextStub(query);
  }
}

// ---------- HTTP handler ----------
export default async function handler(req, res) {
  // Kun POST. Alt annet → 405 med JSON (så fetch .json() funker fint).
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed at /api/rag/chat" });
  }

  try {
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    // Finn siste bruker-innlegg
    const userQuery = pickLastUserMessage(messages);

    // Hent kontekst: prøv Supabase hvis mulig, ellers stub
    const useSupabase = !!supabase;
    const rag = useSupabase
      ? await retrieveRagContextSupabase(userQuery, { topK: 6 })
      : await retrieveRagContextStub(userQuery);

    // Sett sammen systemprompt med ev. kontekst
    const systemPrompt = buildSystemPrompt(rag.contextText);

    // Kjør samtale med OpenAI
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    });

    const reply = chatResponse.choices?.[0]?.message?.content || "";

    return res.status(200).json({
      ok: true,
      reply,
      mode: "rag",
      used: { ai_hits: rag.ai_hits, master_hits: rag.master_hits },
      meta: { rag_source: useSupabase ? "supabase" : "stub" }
    });
  } catch (err) {
    console.error("[/api/rag/chat] Server error:", err);
    return res.status(500).json({ error: "Server error in /api/rag/chat" });
  }
}

// 🧪 Tips for test i DevTools fra DIN app (ikke GitHub):
// fetch('/api/rag/chat', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ messages: [{ role:'user', content:'Hva vet du om dokumentene mine?' }] })
// }).then(r=>r.json()).then(console.log).catch(console.error);
