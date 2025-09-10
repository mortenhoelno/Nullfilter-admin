// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import { getDbClient, getRagContext } from "../../utils/rag";
import { tokenGuard } from "../../utils/tokenGuard";
import personaConfig from "../../config/personaConfig";
import { buildPrompt } from "../../utils/buildPrompt";
import { streamFetchChat } from "../../utils/llmClient";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

function lastUserFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

export default async function handler(req, res) {
  const perf = startPerf("chat");
  const stepLog = [];
  const measure = (name, from) => {
    const ms = perf.measure(name, from);
    stepLog.push({ name, ms });
    return ms;
  };
  const mark = (name) => perf.mark(name);

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    mark("req_in");

    const body = req.body || {};

    // Hent siste melding som prompt
    const userPrompt =
      (typeof body?.q === "string" && body.q) ||
      lastUserFromMessages(body?.messages) ||
      "";

    if (!userPrompt) {
      return res.status(400).json({ error: "Mangler brukerprompt" });
    }

    const topK = Number(body?.topK ?? 6);
    const minSim = Number(body?.minSim ?? 0.0);
    const botId = body?.botId || "nullfilter";

    const persona = personaConfig[botId];
    if (!persona) throw new Error(`Ukjent botId: ${botId}`);
    const { tokenBudget } = persona;

    // 🔄 Embedding
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userPrompt,
    });
    const queryEmbedding = embRes.data[0].embedding;

    // 🔄 DB → RAG
    mark("db_connect_start");
    const db = await getDbClient();
    measure("db_connect_end", "db_connect_start");

    mark("rag_query_start");
    const ragRes = await getRagContext(db, queryEmbedding, { topK, minSim, botId });
    measure("rag_query_end", "rag_query_start");

    const docs = ragRes.docs;
    const contextChunks = ragRes.chunks;

    const maxTokens =
      (tokenBudget?.pinnedMax ?? 0) +
      (tokenBudget?.ragMax ?? 0) +
      (tokenBudget?.replyMax ?? 0);

    // Bruk historikk fra body.messages hvis det finnes
    const historyMessages = Array.isArray(body?.messages)
      ? body.messages.slice(0, -1)
      : [];

    const promptPack = buildPrompt({
      persona,
      userPrompt,
      contextChunks,
      history: historyMessages,
    });

    const guard = tokenGuard({
      systemPrompt: promptPack.messages[0]?.content || "",
      userPrompt,
      contextChunks,
      historyMessages: historyMessages.map((m) => m.content),
      maxTokens,
      replyMax: persona?.tokenBudget?.replyMax ?? 1200,
      model: promptPack.model,
    });

    if (!guard.isValid) {
      return res.status(400).json({
        error: "Prompten ble for lang. Prøv å skrive spørsmålet litt kortere.",
        droppedChunks: guard.droppedChunks,
      });
    }

    // 🔄 Kjør LLM
    mark("llm_req_start");
    const llmReqStartWall = Date.now();

    const resp = await streamFetchChat({
      model: promptPack.model,
      messages: promptPack.messages,
      temperature: promptPack.temperature,
    });

    mark("llm_http_send");

    if (!resp.ok || !resp.body) {
      throw new Error(`LLM HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    let outputText = "";
    let sawFirstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });

      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? "";
          if (!sawFirstToken && (delta?.length || json?.choices?.[0]?.delta?.role)) {
            sawFirstToken = true;
            measure("llm_first_token", "llm_http_send");
          }
          if (delta) {
            outputText += delta;
          }
        } catch {
          // ignorér parsefeil
        }
      }
    }

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    const snap = perf.snapshot({
      tokens: { input: guard.total, output: perf.estimateTokens(outputText) },
      llm: {
        model: promptPack.model,
        requestStartedAt: new Date(llmReqStartWall).toISOString(),
        output: {
          chars: outputText.length,
        },
      },
      rag: { topK, returned: docs.length, minSim },
      steps: [...stepLog],
    });

    return res.status(200).json({
      reply: outputText,
      rag: {
        ai_hits: docs.filter((d) => d.source_type === "ai").length,
        master_hits: docs.filter((d) => d.source_type === "master").length,
      },
      tokenGuard: guard,
      modelUsed: promptPack.model,
      fallbackHit: false,
      topKUsed: topK,
      minSimUsed: minSim,
      perf: snap,
    });
  } catch (err) {
    console.error("chat error", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
