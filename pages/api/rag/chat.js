// pages/api/rag/chat.js — Ryddet versjon (RAG + TokenGuard + buildPrompt + llmClient)
// Bevarer: RPC/fallback, token guard, persona-budsjett. Returnerer JSON (ikke SSE).

import { OpenAI } from "openai";
import { getSupabaseServer } from "../../../utils/supabaseServer";
import personaConfig from "../../../config/personaConfig";
import { tokenGuard } from "../../../utils/tokenGuard";

// ⬇️ Nye utiler
import { buildPrompt } from "../../../utils/buildPrompt";
import { chatCompletion } from "../../../utils/llmClient";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function pickLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

// Historikkinnsamling (uten siste user)
function collectHistory(messages) {
  if (!Array.isArray(messages)) return [];
  const copy = messages.slice(0, -1);
  return copy.filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0);
}

async function retrieveContextRPC(query, { topK, minSim, sourceType }) {
  const supabase = getSupabaseServer();

  // Embedding av brukerens spørsmål
  const emb = await openai.embeddings.create({
    model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
    input: query
  });
  const vector = emb?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) return { contextText: "", ai_hits: 0, master_hits: 0 };

  // RPC mot rag_chunks
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding: vector,
    match_threshold: minSim,
    match_count: topK,
    wanted_source_type: sourceType || null
  });
  if (error || !Array.isArray(data) || data.length === 0) {
    return { contextText: "", ai_hits: 0, master_hits: 0 };
  }

  let ai_hits = 0, master_hits = 0;
  const parts = [];
  for (const row of data) {
    const st = (row.source_type || "").toLowerCase();
    if (st === "ai") ai_hits++; else if (st === "master") master_hits++;
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

  let ai_hits = 0, master_hits = 0;
  const parts = [];
  for (const row of data) {
    const st = (row.source_type || "").toLowerCase();
    if (st === "ai") ai_hits++; else if (st === "master") master_hits++;
    parts.push(row.content || "");
  }
  return { contextText: parts.join("\n---\n"), ai_hits, master_hits };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

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
      sourceType = null,    // "ai" | "master" | null (begge)
      botId = "nullfilter",
      overrideModel,        // valgfritt for eksperimenter
      overrideTemperature   // valgfritt for eksperimenter
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    // Persona – kilde til modell + budsjett
    const persona = personaConfig[botId];
    if (!persona) return res.status(400).json({ error: `Ukjent botId: ${botId}` });

    const userQuery = pickLastUserMessage(messages);
    const history = collectHistory(messages);

    // Hent RAG-kontekst fra rag_chunks (RPC → fallback)
    let rag = await retrieveContextRPC(userQuery, { topK, minSim, sourceType });
    if (!rag.contextText) {
      rag = await retrieveContextFallback(userQuery, { topK, sourceType });
    }

    // Bygg system+messages via util (kontekst legges til under systemprompt)
    const promptPack = buildPrompt({
      persona,
      userPrompt: userQuery,
      contextText: rag.contextText,
      history,
      overrideModel,
      overrideTemperature
    });

    // TokenGuard – bruk nøyaktig systemtekst og persona-budsjett
    const maxTokens =
      (persona?.tokenBudget?.pinnedMax ?? 0) +
      (persona?.tokenBudget?.ragMax ?? 0) +
      (persona?.tokenBudget?.replyMax ?? 0);

    const guard = tokenGuard({
      systemPrompt: promptPack.messages[0]?.content || "",
      userPrompt: userQuery,
      contextChunks: rag.contextText ? [rag.contextText] : [],
      historyMessages: history.map(h => h.content),
      maxTokens,
      replyMax: persona?.tokenBudget?.replyMax ?? 1200,
      model: promptPack.model,
    });

    if (!guard.isValid) {
      // Trimmet kontekst er allerede reflektert i TokenGuard-resultatet,
      // men siden vi bygger systemprompt via util, responderer vi heller med en hyggelig feilmelding.
      return res.status(200).json({
        reply: "Meldingen din + konteksten ble litt for stor for denne modellen. Prøv å spørre litt kortere, så fikser vi resten! 😊",
        rag: { ai_hits: rag.ai_hits, master_hits: rag.master_hits },
        tokenGuard: guard,
        modelUsed: promptPack.model,
        fallbackHit: false
      });
    }

    // Non-stream kall med potensiell fallback (internt håndtert i llmClient)
    const result = await chatCompletion({
      model: promptPack.model,
      messages: promptPack.messages,
      temperature: promptPack.temperature,
      enableFallback: true,
      fallbackModel: "gpt-4o-mini",
    });

    if (!result.ok) {
      return res.status(500).json({ error: result.error, modelTried: result.modelTried });
    }

    const payload = {
      reply: result.reply || "",
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
      modelUsed: result.modelUsed,
      fallbackHit: result.fallbackHit,
      topKUsed: topK,
      minSimUsed: minSim
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error("[/api/rag/chat] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
