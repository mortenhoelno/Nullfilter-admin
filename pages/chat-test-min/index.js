import { useState } from "react";

export default function ChatTestMinPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");

    console.time("⏱️ First token (MIN prompt)");

    const resp = await fetch("/api/chat-test-min", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: input }),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let gotFirstToken = false;

    // legg inn en tom assistant-melding vi fyller fortløpende
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
                console.timeEnd("⏱️ First token (MIN prompt)");
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

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 bg-green-700 text-white font-bold">
        Testbot – Minimal Prompt
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded max-w-xl ${
              m.role === "user"
                ? "bg-blue-200 self-end"
                : "bg-gray-200 self-start"
            }`}
          >
            {m.content}
          </div>
        ))}
      </main>
      <footer className="p-4 border-t flex gap-2">
        <input
          className="flex-1 border p-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv til Testbot (min prompt)..."
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={sendMessage}
        >
          Send
        </button>
      </footer>
    </div>
  );
}

// 👇 Hindrer static export og lar siden kjøre i runtime
export async function getServerSideProps() {
  return { props: {} };
}
