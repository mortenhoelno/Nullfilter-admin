// FERDIG VERSJON: pages/api/chat.js
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid messages" });
  }

  try {
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7
    });

    const reply = chatResponse.choices?.[0]?.message?.content || "";
    res.status(200).json({ reply });
  } catch (error) {
    console.error("❌ OpenAI API-feil:", error);
    res.status(500).json({ error: "AI-svar feilet" });
  }
}
