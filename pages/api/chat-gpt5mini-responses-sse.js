import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const t_request = Date.now();
  res.write(`event: debug\ndata: ${JSON.stringify({ step: "handler_started", model: "gpt-5-mini-2025-08-07", t_request })}\n\n`);

  try {
    const stream = await client.responses.stream({
      model: "gpt-5-mini-2025-08-07",
      input: req.body?.q || "Hei, skriv en liten testhistorie",
    });

    let firstToken = true;

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const t_now = Date.now();

        if (firstToken) {
          firstToken = false;
          res.write(
            `event: debug\ndata: ${JSON.stringify({
              step: "first_token",
              t_first: t_now,
              elapsed_ms: t_now - t_request,
            })}\n\n`
          );
        }

        res.write(`data: ${JSON.stringify({ text: event.delta, t: t_now })}\n\n`);
      } else if (event.type === "response.completed") {
        const t_end = Date.now();
        res.write(
          `event: debug\ndata: ${JSON.stringify({
            step: "completed",
            t_end,
            total_elapsed: t_end - t_request,
          })}\n\n`
        );
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
      }
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
