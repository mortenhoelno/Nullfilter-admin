export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // Les body manuelt
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    let data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (err) {
      res.setHeader("Content-Type", "application/json");
      res.status(400).send({ error: "Invalid JSON body", details: err.message });
      return;
    }

    const userPrompt =
      data?.q || "Hei, skriv en kort historie om en katt på månen.";

    const messages = [
      { role: "system", content: "Du er en hjelpsom test-bot." },
      { role: "user", content: userPrompt },
    ];

    // Sett headere for SSE
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // t_request = når handler starter
    const t_request = Date.now();
    res.write(
      `event: debug\ndata: ${JSON.stringify({ t_request })}\n\n`
    );

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
      const errorText = await resp.text();
      res.write(
        `event: error\ndata: ${JSON.stringify({
          status: resp.status,
          error: errorText,
        })}\n\n`
      );
      res.end();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    let t_firstOpenAI = null;
    let t_firstClient = null;

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
            if (!t_firstOpenAI) {
              t_firstOpenAI = Date.now();
              res.write(
                `event: debug\ndata: ${JSON.stringify({ t_firstOpenAI })}\n\n`
              );
            }
            if (!t_firstClient) {
              t_firstClient = Date.now();
              res.write(
                `event: debug\ndata: ${JSON.stringify({ t_firstClient })}\n\n`
              );
            }
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch (err) {
          res.write(
            `event: error\ndata: ${JSON.stringify({
              error: "JSON parse error",
              details: err.message,
              line,
            })}\n\n`
          );
        }
      }
    }
  } catch (err) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.write(
      `event: fatal\ndata: ${JSON.stringify({
        error: err.message,
        stack: err.stack,
      })}\n\n`
    );
    res.end();
  }
}
