// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

// ⚠️ Initialiser OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ⚠️ Konfigurer Assistant ID per bot
const assistantConfig = {
  nullfilter: {
    assistantId: "asst_qtIurjQdsMuqECP8tO64TfZm",
  },
};

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
    const messages = body.messages || [];
    const botId = body?.botId || "nullfilter";
    const conversationId = body.conversationId; // fra frontend

    const assistantId = assistantConfig[botId]?.assistantId;
    if (!assistantId) {
      throw new Error(`Ukjent bot ID eller ingen Assistant ID funnet for: ${botId}`);
    }

    // 🔄 Håndter samtalehistorikk med Threads
    let threadId = conversationId;

    if (!threadId) {
      const { id } = await openai.beta.threads.create();
      threadId = id;
    }

    // Finn siste melding fra brukeren
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user" || !userMessage.content.trim()) {
      return res.status(400).json({ error: "Mangler gyldig brukerprompt" });
    }

    // 🔄 Legg brukerens melding til tråden
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage.content,
    });

    mark("llm_req_start");

    // 🔄 Start kjøring
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Polling med timeout
    const timeoutMs = 20000; // 20 sek maks
    const pollInterval = 500;
    let waited = 0;

    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

    while (runStatus.status !== "completed") {
      if (runStatus.status === "failed" || runStatus.status === "cancelled") {
        throw new Error(`Run feilet med status: ${runStatus.status}`);
      }
      if (waited > timeoutMs) {
        throw new Error("Run timed out etter 20s");
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      waited += pollInterval;
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // 🔄 Hent siste meldinger
    const threadMessages = await openai.beta.threads.messages.list(threadId, { limit: 1 });
    const lastAssistantMessage = threadMessages.data[0];

    const reply = lastAssistantMessage?.content
      ?.map((c) => c.text?.value || "")
      .join("\n")
      .trim() || "(Ingen svar)";

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    // ✅ Returner svaret og threadId
    return res.status(200).json({
      reply,
      conversationId: threadId,
      perf: stepLog,
    });
  } catch (err) {
    console.error("chat error", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
