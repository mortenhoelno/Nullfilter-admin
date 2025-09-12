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

  const t_request = Date.now();
  res.write(`: ping\n\n`);
  res.write(
    `event: debug\ndata: ${JSON.stringify({
      step: "handler_started",
      t_request,
    })}\n\n`
  );

  try {
    const openaiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        temperature: 0.7,
        max_output_tokens: 200,
        stream: true,
        input: [
          { role: "system", content: "Du er en hjelpsom test-bot." },
          { role: "user", content: q },
        ],
      }),
    });

    if (!openaiResp.ok || !openaiResp.body) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          error: "OpenAI error",
          status: openaiResp.status,
        })}\n\n`
      );
      return res.end();
    }

    const reader = openaiResp.body.getReader();
    const decoder = new TextDecoder();
    let tokenCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split(/\r?\n/);

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          res.write(
            `event: summary\ndata: ${JSON.stringify({
              tokens: tokenCount,
              total_elapsed: Date.now() - t_request,
            })}\n\n`
          );
          res.write(`event: end\ndata: {}\n\n`);
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const delta = json?.output_text || json?.output?.[0]?.content?.[0]?.text;
          if (delta) {
            tokenCount++;
            if (tokenCount === 1) {
              res.write(
                `event: debug\ndata: ${JSON.stringify({
                  step: "first_token",
                  elapsed_ms: Date.now() - t_request,
                })}\n\n`
              );
            }
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch {
          // ignorer uferdige linjer
        }
      }
    }
  } catch (err) {
    res.write(
      `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
    );
    res.end();
  }
}
