export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    return res.end("Method not allowed");
  }

  const { q } = req.body || {};
  if (!q) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    return res.end("Missing prompt");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Flush hack
  res.write(`: ping\n\n`);

  const t_request = Date.now();
  res.write(`event: debug\ndata: ${JSON.stringify({ step: "handler_started", t_request })}\n\n`);

  try {
    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // her tester vi 4o-mini
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: "Du er en hjelpsom test-bot." },
          { role: "user", content: q },
        ],
      }),
    });

    if (!openaiResp.ok || !openaiResp.body) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "OpenAI error", status: openaiResp.status })}\n\n`);
      return res.end();
    }

    const reader = openaiResp.body.getReader();
    const decoder = new TextDecoder();
    let bufCount = 0;

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
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) {
            bufCount++;
            if (bufCount === 1) {
              res.write(`event: debug\ndata: ${JSON.stringify({ step: "first_token", t: Date.now(), elapsed_ms: Date.now() - t_request })}\n\n`);
            }
            if (bufCount === 100 || bufCount === 200 || bufCount === 500 || bufCount === 1000) {
              res.write(`event: debug\ndata: ${JSON.stringify({ milestone: bufCount, t: Date.now(), elapsed_ms: Date.now() - t_request })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch (err) {
          // ignorer uferdige linjer
        }
      }
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
