// pages/api/rag/chat.js — Oppdatert til å bruke getRagContext + embedding

import OpenAI from "openai";
import { getDbClient, getRagContext } from "../../../utils/rag";
import personaConfig from "../../../config/personaConfig";
import { tokenGuard } from "../../../utils/tokenGuard";
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

function collectHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(0, -1).filter((m) => m?.content?.trim());
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });
    if (!process.env.DB_HTTP_URL || !process.env.DB_HTTP_TOKEN || !process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing required environment variables" });
    }

    const {
      messages,
      topK = 6,
      minSim = 0.2,
      sourceType = null,
      botId = "nullfilter",
      overrideModel,
      overrideTemperature,
    } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array" });
    }

    const persona = personaConfig[botId];
    if (!persona) return res.status(400).json({ error: `Ukjent botId: ${botId}` });

    const userQuery = pickLastUserMessage(messages);
    const history = collectHistory(messages);

    // Pinned chunks (samme som før)
    let pinnedChunks = [];
    if (persona.pinnedDocId) {
      const db = await getDbClient();
      const { rows } = await db.query("fetch_docs", { ids: [persona.pinnedDocId] });
      pinnedChunks = rows.map((r) => r.content || "");
    }

    // 🔄 Generer embedding for brukerens query
    const emb = await openai.embeddings.create({
      model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
      input: userQuery,
    });
    const queryEmbedding = emb?.data?.[0]?.embedding;

    // 🔄 Hent RAG-kontekst via Edge Function
    const db = await getDbClient();
    const ragRes = await getRagContext(db, queryEmbedding, { topK: topK - pinnedChunks.length, minSim, sourceType });

    const allChunks = [...pinnedChunks, ...ragRes.chunks];
    const contextText = allChunks.join("\n---\n");

    const promptPack = buildPrompt({
      persona,
      userPrompt: userQuery,
      contextText,
      history,
      overrideModel,
      overrideTemperature,
    });

    const maxTokens =
      (persona?.tokenBudget?.pinnedMax ?? 0) +
      (persona?.tokenBudget?.ragMax ?? 0) +
      (persona?.tokenBudget?.replyMax ?? 0);

    const guard = tokenGuard({
      systemPrompt: promptPack.messages[0]?.content || "",
      userPrompt: userQuery,
      contextChunks: allChunks,
      historyMessages: history.map((h) => h.content),
      maxTokens,
      replyMax: persona?.tokenBudget?.replyMax ?? 1200,
      model: promptPack.model,
    });

    if (!guard.isValid) {
      return res.status(200).json({
        reply: "Meldingen din + konteksten ble litt for stor for denne modellen. Prøv å spørre litt kortere! 😊",
        rag: { ai_hits: 0, master_hits: 0 }, // teller ikke chunks her
        tokenGuard: guard,
        modelUsed: promptPack.model,
        fallbackHit: false,
      });
    }

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

    return res.status(200).json({
      reply: result.reply || "",
      rag: { ai_hits: ragRes.meta?.returned ?? 0, master_hits: 0 },
      tokenGuard: guard,
      modelUsed: result.modelUsed,
      fallbackHit: result.fallbackHit,
      topKUsed: topK,
      minSimUsed: minSim,
    });
  } catch (err) {
    console.error("[/api/rag/chat] error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
