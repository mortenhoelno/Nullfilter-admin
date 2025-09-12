// pages/api/chat-stream.js
import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

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
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

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

    // 🔄 Setup SSE
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // 🔄 Start streaming fra OpenAI
    const stream = await openai.responses.stream({
      prompt: {
        id: cfg.promptId,
        version: cfg.version,
      },
      input: userMessage.content,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        // Send JSON, slik at mellomrom/linjeskift ikke forsvinner
        res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
      } else if (event.type === "response.completed") {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    }
  } catch (err) {
    console.error("chat-stream error", err);
    res.write(`data: ${JSON.stringify({ error: String(err?.message || err) })}\n\n`);
    res.end();
  }
}
