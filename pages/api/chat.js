// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const userMessage = messages[messages.length - 1];
    if (!userMessage || userMessage.role !== "user" || !userMessage.content.trim()) {
      return res.status(400).json({ error: "Mangler gyldig brukerprompt" });
    }

    mark("llm_req_start");

    // Kjør Responses API med Prompt ID
    const response = await openai.responses.create({
      prompt: {
        id: cfg.promptId,
        version: cfg.version,
      },
      input: userMessage.content,
      store: true,
    });

    const reply =
      response.output?.[0]?.content?.[0]?.text?.trim() || "(Ingen svar)";

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    // ✅ Viktig: bruk JSON.stringify for å bevare whitespace og linjeskift
    return res.status(200).json({
      reply: reply,
      perf: stepLog,
    });
  } catch (err) {
    console.error("chat error", err);
    return res
      .status(500)
      .json({ error: String(err?.message || err) });
  }
}
