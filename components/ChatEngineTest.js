async function sendMessageSSE(userMsg) {
  console.time("⏱️ First token to screen");

  const resp = await fetch("/api/chat-test-sse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: userMsg }),
  });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let gotFirstToken = false;

  setMessages((msgs) => [...msgs, { role: "assistant", content: "" }]);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop();

    for (const part of parts) {
      if (part.startsWith("data:")) {
        try {
          const json = JSON.parse(part.slice(5));
          if (json.text) {
            if (!gotFirstToken) {
              gotFirstToken = true;
              console.timeEnd("⏱️ First token to screen");
            }

            setMessages((msgs) => {
              const copy = [...msgs];
              copy[copy.length - 1].content += json.text;
              return copy;
            });
          }
        } catch {}
      }
    }
  }
}
