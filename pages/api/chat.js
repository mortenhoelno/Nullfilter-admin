// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

// ⚠️ NYTT: Initialiserer OpenAI-klienten
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ⚠️ NYTT: Konfigurerer bot ID og Assistant ID.
// I en ekte app ville dette hentes fra en database eller config-fil.
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
    const conversationId = body.conversationId; // Henter conversationId fra frontend

    const assistantId = assistantConfig[botId]?.assistantId;
    if (!assistantId) {
      throw new Error(`Ukjent bot ID eller ingen Assistant ID funnet for: ${botId}`);
    }

    // 🔄 Håndter samtalehistorikk med Threads
    let threadId = conversationId;
    
    // Hvis ingen threadId sendes, opprett en ny tråd.
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Finn den siste meldingen fra brukeren
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== 'user' || !userMessage.content.trim()) {
        return res.status(400).json({ error: "Mangler gyldig brukerprompt" });
    }

    // 🔄 Legg brukerens melding til tråden
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userMessage.content,
    });
    
    mark("llm_req_start");
    
    // 🔄 Kjør Assistant-en og vent på svar
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Polling-løkke for å vente på at kjøringen fullføres
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
    
    // 🔄 Hent de siste meldingene og finn svaret fra assistenten
    const threadMessages = await openai.beta.threads.messages.list(threadId, { limit: 1 });
    const lastAssistantMessage = threadMessages.data[0];
    const reply = lastAssistantMessage.content[0].text.value;

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");
    
    // Returner svaret og threadId til frontend
    return res.status(200).json({
      reply: reply,
      conversationId: threadId,
      // Du kan legge til perf-målinger her om du vil
    });
    
  } catch (err) {
    console.error("chat error", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
