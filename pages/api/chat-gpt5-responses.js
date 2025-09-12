// pages/api/chat-gpt5-responses.js
import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.responses.create({
      model: "gpt-5",
      input: "Skriv en kort historie om en katt som hopper på månen.",
    });

    res.status(200).json({ text: response.output_text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
