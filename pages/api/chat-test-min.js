export const config = {
  runtime: "edge", // vi vil unngå buffering
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const userPrompt = body?.q || "";

  // 🔹 Minimal prompt: kun systemmelding + bruker
  const messages = [
    { role: "system", content: "Du er en enkel test-bot. Svar kort." },
    { role: "user", content: userPrompt },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07", // samme modell som vi tester
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
                console.log("→ First token sent (MIN prompt):", Date.now());
              }
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ text: delta })}\n\n`
                )
              );
            }
          } catch {}
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
