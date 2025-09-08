// pages/api/rag/chat.js — FERDIG VERSJON (rag_chunks + match_rag_chunks + fallback + Token Guard)
// Holder fokus: ÉN ting – RAG-kontekst fra public.rag_chunks inn i chat-svar.
//
// - Prøver Supabase RPC `match_rag_chunks` (pgvector).
// - Faller tilbake til enkel tekstsøk (ILIKE) hvis RPC/embeddings ikke er tilgjengelig.
// - Bruker utils/supabaseServer for konsistent Supabase-klient.
// - ✅ Med Token Guard som trimmer kontekst mot budsjett (uten å endre eksisterende RAG-flyt).

import OpenAI from "openai";
import { getSupabaseServer } from "../../../utils/supabaseServer";
import { tokenGuard } from "../../../utils/tokenGuard";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function pickLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function collectHistoryTexts(messages) {
  if (!Array.isArray(messages)) return [];
  // Legg inn alle tidligere meldinger (uten siste user) som “historikk-tekst”
  const copy = messages.slice(0, -1);
  return copy
    .map((m) => (typeof m?.content === "string" ? m.content : ""))
    .filter(Boolean);
}

function buildSystemPrompt(contextText) {
  const base = [
    "Du er en varm, presis og hjelpsom assistent.",
    "Bruk konteksten under hvis relevant. Hvis noe mangler eller er uklart: si det ærlig.",
  ];
  if (contextText) {
    base.push("Relevant kontekst:");
    base.push("---");
    base.push(contextText);
    base.push("---");
  }
  return base.join("\n");
}

async function retrieveContextRPC(query, { topK, minSim, sourceType }) {
  const supabase = getSupabaseServer();

  // Embedding av brukerens spørsmål
  const emb = await openai.embeddings.create({
    model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
    input: query,
  });
  const vector = emb?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) return { contextText: "", ai_hits: 0, master_hits: 0 };

  // RPC mot rag_chunks
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding: vector,
    match_threshold: minSim,
    match_count: topK,
    wanted_source_type: sourceType || null,
  });
  if (error || !Array.isArray(data) || data.length === 0) {
    return { contextText: "", ai_hits: 0, master_hits: 0 };
  }

  let ai_hits = 0,
    master_hits = 0;
  const parts = [];
  for (const row of data) {
    const st = (row.source_type || "").toLowerCase();
    if (st === "ai") ai_hits++;
    else if (st === "master") master_hits++;
    parts.push(row.content || "");
  }
  return { contextText: parts.join("\n---\n"), ai_hits, master_hits };
}

async function retrieveContextFallback(query, { topK, sourceType }) {
  const supabase = getSupabaseServer();

  let q = supabase
    .from("rag_chunks")
    .select("source_type, content")
    .ilike("content", `%${query}%`)
    .limit(topK);

  if (sourceType) q = q.eq("source_type", sourceType);

  const { data, error } = await q;
  if (error || !Array.isArray(data) || data.length === 0) {
    return { contextText: "", ai_hits: 0, master_hits: 0 };
  }

  let ai_hits = 0,
    master_hits = 0;
  const parts = [];
  for (const row of data) {
    const st = (row.source_type || "").toLowerCase();
    if (st === "ai") ai_hits++;
    else if (st === "master") master_hits++;
    parts.push(row.content || "");
  }
  return { contextText: parts.join("\n---\n"), ai_hits, master_hits };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

    // Merk: getSupabaseServer() bruker interne env, men vi bevarer denne sjekken slik du hadde den
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase creds mangler" });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY mangler" });
    }

    const {
      messages,
      topK = 6,
      minSim = 0.2,
      sourceType = null, // "ai" | "master" | null (begge)
      model = "gpt-4o",
      temperature = 0.7,
      budget, // valgfritt: { maxTokens, replyMax, model }
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    const userQuery = pickLastUserMessage(messages);

    // Hent RAG-kontekst fra rag_chunks (RPC → fallback)
    let rag = await retrieveContextRPC(userQuery, { topK, minSim, sourceType });
    if (!rag.contextText) {
      rag = await retrieveContextFallback(userQuery, { topK, sourceType });
    }

    // ✅ Token Guard: trimm kontekst mot budsjett (vi endrer ikke eksisterende RAG-flyt)
    const historyMessages = collectHistoryTexts(messages);
    const contextChunks = rag.contextText ? [rag.contextText] : [];
    const maxTokens = budget?.maxTokens ?? 8000;
    const replyMax = budget?.replyMax ?? 1200;
    const modelUsed = budget?.model ?? model;

    const guard = tokenGuard({
      systemPrompt: buildSystemPrompt(rag.contextText), // basis m/ kontekst
      userPrompt: userQuery,
      contextChunks, // kan bli kuttet
      historyMessages, // teller mot budsjett
      maxTokens,
      replyMax,
      model: modelUsed,
    });

    // Rekonstruer systemprompt basert på inkluderte chunks (trimmet av tokenGuard)
    const guardedContext = guard.includedChunks?.[0] ?? "";
    const system = buildSystemPrompt(guardedContext);

    const completion = await openai.chat.completions.create({
      model: modelUsed,
      temperature,
      messages: [{ role: "system", content: system }, ...messages],
    });

    const reply = completion.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      reply,
      rag: { ai_hits: rag.ai_hits, master_hits: rag.master_hits },
      tokenGuard: {
        isValid: guard.isValid,
        total: guard.total,
        overflow: guard.overflow,
        includedCount: guard.includedCount,
        droppedCount: guard.droppedCount,
        breakdown: guard.breakdown,
        meta: guard.meta,
      },
      modelUsed,
      topKUsed: topK,
      minSimUsed: minSim,
    });
  } catch (err) {
    console.error("[/api/rag/chat] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
