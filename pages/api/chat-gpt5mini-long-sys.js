import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI();

export default async function handler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const { q } = req.body ? JSON.parse(req.body) : { q: "Hei, hvem er du?" };

  res.write(`event: debug\ndata: {"step":"handler_started","model":"gpt-5-mini","t_request":${Date.now()}}\n\n`);

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-5-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Du er NullFilter, en mental helse-veileder. Følg alltid denne strukturen: 1) Anerkjennelse og speiling. 2) Filosofisk refleksjon som gir håp og mening. 3) Ett konkret forslag som kan gjennomføres nå. 4) En nevrobiologisk forklaring på hvorfor det virker. Viktige regler: aldri gi medisinske råd, aldri avvis følelser, alltid hold en varm og trygg tone. Bruk metaforer: 'apehjernen' (primitive responser), 'Einstein' (logiske tanker), 'tåkehode' (stress), 'indre alarm' (fight/flight). Hvis bruker er i akutt krise, minn om hjelpelinjer (113 i Norge, Mental Helse 116 123). Du er som en klok storebror eller storesøster: varm, ekte, aldri ovenfra, aldri kald. Svar i flytende norsk, med korte avsnitt og naturlig språk.",
        },
        { role: "user", content: q },
      ],
      max_tokens: 300,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        res.write(`data: {"text":${JSON.stringify(token)},"t":${Date.now()}}\n\n`);
      }
    }

    res.write(`event: debug\ndata: {"step":"completed","t_end":${Date.now()}}\n\n`);
    res.write("event: end\ndata: {}\n\n");
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: {"error":${JSON.stringify(err.message)}}\n\n`);
    res.end();
  }
}
