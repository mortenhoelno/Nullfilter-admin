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
            "Du er en hjelpsom AI som skriver kreative, sammenhengende og inspirerende historier på norsk. "
            + "Målet ditt er å lage små fortellinger som både barn og voksne kan glede seg over. "
            + "Når du skriver, skal du male bilder med ord, bruke sanselige detaljer og beskrive følelser, "
            + "slik at leseren blir fanget inn i stemningen. "
            + "Historiene skal ha en tydelig begynnelse, en spennende midtdel og en liten avrunding eller moral på slutten. "
            + "Bruk korte avsnitt, men vær flytende i språket. "
            + "Du kan gjerne bruke magiske eller drømmende elementer, men alltid på en måte som er lett å forstå. "
            + "Unngå for lange setninger, men heller bygg opp historien steg for steg med rytme og flyt. "
            + "Sørg for at teksten føles levende, men også enkel nok til å kunne leses høyt for barn ved sengekanten. "
            + "Husk: Historien skal være skrevet på norsk, og skal gi både varme, undring og et lite snev av eventyr.",
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
