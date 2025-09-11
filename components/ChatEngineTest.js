export const config = {
  runtime: "edge", // 👈 Viktig for å slippe buffering hos Vercel
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const userPrompt = body?.q || "";

  // Bygg et minimalt prompt (her kan du utvide med buildPrompt/persona senere)
  const messages = [
    { role: "system", content: "Du er en hjelpsom test-bot." },
    { role: "user", content: userPrompt },
  ];

  // Kall OpenAI med streaming
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07", // 👈 samme modell som NullFilter
      stream: true,
      messages,
    }),
  });

  if (!resp.ok || !resp.body) {
    return new Response(
      `OpenAI error: ${resp.status} ${await resp.text()}`,
      { status: 500 }
    );
  }

  // Pipe OpenAI sin stream direkte til klienten
  const stream = new ReadableStream({
    async start(controller) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      let gotFirstToken = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split(/\r?\n/);

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            controller.enqueue(
              new TextEncoder().encode(`event: end\ndata: {}\n\n`)
            );
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || "";
            if (delta) {
              if (!gotFirstToken) {
                gotFirstToken = true;
                console.log("→ First token sent to client at:", Date.now());
              }
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ text: delta })}\n\n`
                )
              );
            }
          } catch {
            // ignorér parsefeil
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
