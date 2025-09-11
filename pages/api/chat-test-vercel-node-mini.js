export const config = {
  runtime: "nodejs", // bruker Node runtime for enklere streaming-debug
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(JSON.parse(data || "{}")));
  });

  const userPrompt = body?.q || "Hei, gi meg et eksempel på tekst";

  // Start SSE-respons
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const t_request = Date.now();
  res.write(`event: debug\ndata: ${JSON.stringify({ t_request })}\n\n`);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // 👈 kjører på 4o-mini
      stream: true,
      messages: [
        { role: "system", content: "Du er en hjelpsom test-bot." },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  let gotFirst = false;

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
          if (!gotFirst) {
            gotFirst = true;
            const t_first = Date.now();
            res.write(
              `event: debug\ndata: ${JSON.stringify({
                t_first,
                elapsed_ms: t_first - t_request,
                step: "first_token",
              })}\n\n`
            );
          }
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      } catch {
        // Ignorerer ufullstendige linjer
      }
    }
  }
}
