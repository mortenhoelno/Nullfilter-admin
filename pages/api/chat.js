// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Her kan du mappe botId → model / promptId hvis du vil ha flere bots
const botConfig = {
  nullfilter: {
    model: "gpt-4.1-mini",
    // Hvis du har lagret et prompt i OpenAI console kan du bruke:
    // prompt: { id: "pmpt_xxxxx", version: "1" }
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

    const cfg = botConfig[botId];
    if (!cfg) {
      throw new Error(`Ukjent bot ID: ${botId}`);
    }

    // Ta siste melding fra bruker
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user" || !userMessage.content.trim()) {
      return res.status(400).json({ error: "Mangler gyldig brukerprompt" });
    }

    mark("llm_req_start");

    // 🔄 Bruk Responses API
    const response = await openai.responses.create({
      model: cfg.model,
      input: userMessage.content,
      // Hvis du heller vil bruke lagret prompt:
      // prompt: cfg.prompt
    });

    const reply =
      response.output?.[0]?.content?.[0]?.text?.trim() || "(Ingen svar)";

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    return res.status(200).json({
      reply,
      perf: stepLog,
    });
  } catch (err) {
    console.error("chat error", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
