import { buildPrompt } from "../../utils/buildPrompt";
import { streamFetchChat } from "../../utils/llmClient";
import personaConfig from "../../config/personaConfig";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const body = req.body || {};
  const userPrompt = body?.q || "";
  const persona = personaConfig["nullfilter"]; // 👈 bruk NullFilter-config som basis

  const promptPack = buildPrompt({
    persona,
    userPrompt,
    contextChunks: [],
    history: [],
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const resp = await streamFetchChat({
    model: promptPack.model,
    messages: promptPack.messages,
  });

  if (!resp.ok || !resp.body) {
    res.write(`data: ${JSON.stringify({ error: "LLM stream feilet" })}\n\n`);
    res.end();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
        return;
      }
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content || "";
        if (delta) {
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      } catch {}
    }
  }
}
