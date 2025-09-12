import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { q } = req.body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  res.write(`: ping\n\n`);
  res.write(
    `event: debug\ndata: ${JSON.stringify({
      step: "handler_started",
      model: "gpt-5-mini",
      t_request: Date.now(),
    })}\n\n`
  );

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-5-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Du er en hjelpsom AI som skriver korte og fengende historier. Svar på norsk. Vær kreativ, men hold historien enkel, slik at både barn og voksne kan forstå den.",
        },
        { role: "user", content: q },
      ],
    });

    let firstTokenTime;
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
          res.write(
            `event: debug\ndata: ${JSON.stringify({
              step: "first_token",
              t_first: firstTokenTime,
              elapsed_ms: firstTokenTime - Number(res.req.t_request || Date.now()),
            })}\n\n`
          );
        }
        res.write(
          `data: ${JSON.stringify({ text: token, t: Date.now() })}\n\n`
        );
      }
    }

    res.write(
      `event: debug\ndata: ${JSON.stringify({
        step: "completed",
        t_end: Date.now(),
      })}\n\n`
    );
    res.write(`event: end\ndata: {}\n\n`);
    res.end();
  } catch (err) {
    console.error("Error in handler:", err);
    res.write(
      `event: error\ndata: ${JSON.stringify({
        error: "OpenAI error",
        details: err.message,
      })}\n\n`
    );
    res.end();
  }
}
