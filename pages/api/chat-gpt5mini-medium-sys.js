import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Manuell parsing av body i Node runtime
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", resolve);
  });

  let q = "Hei, hvem er du?";
  try {
    const parsed = JSON.parse(body);
    if (parsed.q) q = parsed.q;
  } catch (err) {
    // Ignorer feil og bruk default q
  }

  res.write(
    `event: debug\ndata: {"step":"handler_started","model":"gpt-5-mini","t_request":${Date.now()}}\n\n`
  );

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-5-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Du er NullFilter, en mental helse-veileder. Du svarer alltid med: 1) anerkjennelse, 2) filosofisk refleksjon, 3) ett konkret forslag, 4) nevrobiologisk forklaring. Bruk metaforer som 'apehjernen', 'indre alarm', 'tåkehode'. Vær varm og ekte, aldri ovenfra.",
        },
        { role: "user", content: q },
      ],
      max_tokens: 300,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        res.write(
          `data: {"text":${JSON.stringify(token)},"t":${Date.now()}}\n\n`
        );
      }
    }

    res.write(
      `event: debug\ndata: {"step":"completed","t_end":${Date.now()}}\n\n`
    );
    res.write("event: end\ndata: {}\n\n");
    res.end();
  } catch (err) {
    res.write(
      `event: error\ndata: {"error":${JSON.stringify(err.message)}}\n\n`
    );
    res.end();
  }
}
