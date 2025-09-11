import { useState } from "react";

export default function ChatEngineTest() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((msgs) => [...msgs, userMsg]);

    setInput("");

    const resp = await fetch("/api/chat-test-sse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: input }),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // legg inn en tom assistant-melding for å fylle på underveis
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded ${
              m.role === "user" ? "bg-blue-200 self-end" : "bg-gray-200 self-start"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <div className="p-4 flex gap-2 border-t">
        <input
          className="flex-1 border p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv til Testbot..."
        />
        <button className="bg-blue-500 text-white px-4 py-2" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
