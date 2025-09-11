import OpenAI from "openai";
export default async function handler(req, res) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Hei, fungerer du?" }],
    });
    res.status(200).json(resp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
}
