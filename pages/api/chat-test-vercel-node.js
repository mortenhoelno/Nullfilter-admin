// ❌ Ingen export config -> kjører på Vercel sin Node serverless runtime

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const body = await req.body
    ? JSON.parse(req.body)
    : { q: "Hei, skriv en kort historie om en katt på månen." };

  const userPrompt = body?.q || "Hei, skriv en kort historie om en katt på månen.";

  const messages = [
    { role: "system", content: "Du er en hjelpsom test-bot." },
    { role: "user", content: userPrompt },
  ];

  // Sett headere for SSE
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07",
      stream: true,
      messages,
    }),
  });

  if (!resp.ok || !resp.body) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: await resp.text() })}\n\n`);
    res.end();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split(/\r?\n/);

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        res.write("event: end\ndata: {}\n\n");
        res.end();
        return;
      }
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content || "";
        if (delta) {
          buffer += delta;
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      } catch (err) {
        // ignorer parse-feil
      }
    }
  }
}
