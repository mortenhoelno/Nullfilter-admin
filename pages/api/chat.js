// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Konfigurasjon for bots
const botConfig = {
  nullfilter: {
    promptId: "pmpt_68c3eefbcc6881968424629195623d45008a7b1e813c26e2",
    version: "1",
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
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    mark("req_in");

    const body = req.body || {};
    const messages = body.messages || [];
    const botId = body?.botId || "nullfilter";

    const cfg = botConfig[botId];
    if (!cfg) {
      throw new Error(`Ukjent bot ID: ${botId}`);
    }

    // Finn siste melding fra bruker
    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user" || !userMessage.content.trim()) {
      return res.status(400).json({ error: "Mangler gyldig brukerprompt" });
    }

    // 🔄 Setup SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    mark("llm_req_start");

    // 🔄 Start streaming fra OpenAI Responses API
    const stream = await openai.responses.stream({
      prompt: {
        id: cfg.promptId,
        version: cfg.version,
      },
      input: userMessage.content,
      store: true,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        res.write(`data: ${event.delta}\n\n`);
      } else if (event.type === "response.completed") {
        mark("llm_stream_ended");
        measure("llm_stream_ended", "llm_req_start");
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    }
  } catch (err) {
    console.error("chat error", err);
    res.write(`data: [ERROR] ${String(err?.message || err)}\n\n`);
    res.end();
  }
}
