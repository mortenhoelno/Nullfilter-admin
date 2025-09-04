// FERDIG VERSJON: pages/api/rag/chat.js
// — RAG-endepunkt som tar POST, bruker Supabase RPC "match_chunks" hvis mulig,
// — logger dokument-bruk til tabellen "rag_usage", og returnerer JSON med meta.

import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let supabase = null;
async function getSupabase() {
  if (supabase) return supabase;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return supabase;
}

function pickLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function buildSystemPrompt(contextText) {
  const base = [
    "Du er en hjelpsom assistent.",
    "Når du har faktagrunnlag (kontekst) under, prioriter dette. Hvis noe mangler i konteksten, si det ærlig."
  ];
  if (contextText) {
    base.push("Relevant kontekst:");
    base.push("---");
    base.push(contextText);
    base.push("---");
  }
  return base.join("\n");
}

// ── STUB fallback (ingen Supabase / ingen treff) ───────────────────────────────
async function retrieveRagContextStub(_query) {
  return {
    contextText: "",
    ai_hits: 0,
    master_hits: 0,
    docCounts: {},     // { doc_id: { source_type, hits } }
    usedRows: []       // originaltreff (tom)
  };
}

// ── Hent RAG-kontekst via Supabase RPC "match_chunks" ─────────────────────────
async function retrieveRagContextSupabase(query, { topK = 6 } = {}) {
  const sb = await getSupabase();
  if (!sb) return retrieveRagContextStub(query);

  try {
    // 1) Embedding av spørsmålet
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query
    });
    const vector = emb?.data?.[0]?.embedding;
    if (!Array.isArray(vector)) throw new Error("Embedding mangler");

    // 2) Hent topp-treff
    // Forventet at RPC returnerer: content, source_type, doc_id, similarity
    const { data, error } = await sb.rpc("match_chunks", {
      embedding: vector,
      match_count: topK,
      min_cosine_sim: 0.2
    });

    if (error) {
      console.warn("[/api/rag/chat] RPC match_chunks feilet:", error.message);
      return retrieveRagContextStub(query);
    }
    if (!Array.isArray(data) || data.length === 0) {
      return retrieveRagContextStub(query);
    }

    let ai_hits = 0, master_hits = 0;
    const parts = [];
    const docCounts = {};   // { [doc_id]: { source_type, hits } }

    for (const row of data) {
      const txt = row.content || row.text || row.chunk || "";
      const src = (row.source_type || "").toLowerCase();
      const docId = row.doc_id ?? null;

      if (src === "ai") ai_hits++;
      else if (src === "master") master_hits++;

      if (txt) parts.push(txt);

      if (docId != null) {
        if (!docCounts[docId]) {
          docCounts[docId] = { source_type: src || "ai", hits: 0 };
        }
        docCounts[docId].hits += 1;
      }
    }

    const contextText = parts.join("\n\n");
    return { contextText, ai_hits, master_hits, docCounts, usedRows: data };
  } catch (err) {
    console.warn("[/api/rag/chat] retrieveRagContextSupabase error:", err?.message);
    return retrieveRagContextStub(query);
  }
}

// ── Logg RAG-bruk pr. doc_id i tabellen "rag_usage" ───────────────────────────
async function logRagUsage({ docCounts, route = "/api/rag/chat" }) {
  const sb = await getSupabase();
  if (!sb || !docCounts || !Object.keys(docCounts).length) return;

  const rows = Object.entries(docCounts).map(([doc_id, v]) => ({
    doc_id: Number(doc_id),
    source_type: v.source_type || "ai",
    hits: v.hits || 0,
    route
  }));

  // Ikke la logging knekke svaret – swallow errors
  const { error } = await sb.from("rag_usage").insert(rows);
  if (error) {
    console.warn("[/api/rag/chat] rag_usage insert feilet:", error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed at /api/rag/chat" });
  }

  try {
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    const userQuery = pickLastUserMessage(messages);
    const sb = await getSupabase();
    const useSupabase = !!sb;

    const rag = useSupabase
      ? await retrieveRagContextSupabase(userQuery, { topK: 6 })
      : await retrieveRagContextStub(userQuery);

    const systemPrompt = buildSystemPrompt(rag.contextText);

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    });

    const reply = chatResponse.choices?.[0]?.message?.content || "";

    // Logg bruk (ikke await – men vi lar det await’e for enkelhet/robusthet)
    await logRagUsage({ docCounts: rag.docCounts, route: "/api/rag/chat" });

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
