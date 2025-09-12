// FERDIG VERSJON: pages/chat-nullfilter/index.js
// Nullfilter-chat med streaming fra /api/chat-stream (SSE)

import { useState, useEffect } from "react";
import {
  createConversation,
  saveMessage,
  getConversationByEmail,
} from "../../utils/storage";
import ChatEngine from "../../components/ChatEngine";
import personaConfig from "../../config/personaConfig";

const config = personaConfig.nullfilter;

export default function NullfilterChat() {
  const [useMemory, setUseMemory] = useState(false);
  const [email, setEmail] = useState("");
  const [consentToFollowUp, setConsentToFollowUp] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: config.intro },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadConversation = async () => {
      if (useMemory && email && !conversation) {
        const existing = await getConversationByEmail(email, config.slug);
        if (existing) {
          setConversation(existing);
          if (existing.messages?.length > 0) {
            setMessages(existing.messages);
          }
        } else {
          const newConv = await createConversation(email, config.slug);
          setConversation(newConv);
        }
      }
    };
    loadConversation();
  }, [useMemory, email]);

  // 🚀 Send melding med streaming fra /api/chat-stream
  const sendMessage = async (text) => {
    const toSend = (text ?? chatInput).trim();
    if (!toSend) return;

    const newMessage = { role: "user", content: toSend };
    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");
    if (conversation) await saveMessage(conversation.id, newMessage);

    try {
      setIsLoading(true);

      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: "nullfilter",
          messages: [...messages, newMessage],
        }),
      });

      if (!res.body) throw new Error("Mangler stream-body fra API");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Start ny melding fra assistenten
      let assistantMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.startsWith("data:"));

        for (let line of lines) {
          try {
            const data = JSON.parse(line.replace(/^data:\s*/, ""));

            if (data.delta) {
              assistantMessage.content += data.delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMessage };
                return updated;
              });
            } else if (data.done) {
              setIsLoading(false);
              if (conversation) {
                await saveMessage(conversation.id, assistantMessage);
              }
              return;
            } else if (data.error) {
              console.error("Stream error:", data.error);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error("Parse error:", e, line);
          }
        }
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "En feil oppsto under samtalen. Prøv igjen senere.",
        },
      ]);
    }
  };

  const handleStarterClick = (msg) => {
    setChatInput(msg);
    sendMessage(msg);
  };

  const starters =
    config.starters && config.starters.length > 0
      ? config.starters
      : [
          "Hvordan kan jeg roe meg ned når tankene spinner?",
          "Hva gjør jeg når jeg føler meg helt alene?",
          "Hvorfor blir jeg så redd uten grunn?",
          "Hvordan kan jeg få mer energi i hverdagen?",
        ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Avatar + intro */}
        <div className="flex justify-center">
          <img
            src={config.avatar}
            alt={config.name}
            className="w-32 h-32 rounded-full border border-gray-300 shadow"
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold">{config.name}</h1>
          <p className="mt-2 text-gray-600">{config.description}</p>
        </div>

        {/* Disclaimer hvis satt */}
        {config.disclaimer && (
          <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded-md text-sm">
            <p>{config.disclaimer}</p>
          </div>
        )}

        {/* Brukertypevalg */}
        <div className="space-y-2">
          <p className="font-medium">Hvordan vil du bruke chatboten?</p>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="memory"
              checked={!useMemory}
              onChange={() => setUseMemory(false)}
            />
            Anonym (ingenting lagres)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="memory"
              checked={useMemory}
              onChange={() => setUseMemory(true)}
            />
            Husk meg og tidligere samtaler (bruk e-post)
          </label>

          {useMemory && (
            <input
              type="email"
              className="w-full border px-3 py-2 rounded"
              placeholder="Skriv inn din e-post for å lagre samtalen"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          {useMemory && (
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={consentToFollowUp}
                onChange={(e) => setConsentToFollowUp(e.target.checked)}
              />
              Send meg en oppfølging på e-post etter samtalen
            </label>
          )}
        </div>

        {/* Startbobler */}
        <div className="space-y-2">
          <p className="font-medium">Hva vil du snakke om? Trykk på en boble:</p>
          <div className="flex flex-wrap gap-2">
            {starters.map((msg, idx) => (
              <button
                key={idx}
                onClick={() => handleStarterClick(msg)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-full text-sm shadow"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        {/* ChatEngine */}
        <ChatEngine
          messages={messages}
          input={chatInput}
          setInput={setChatInput}
          onSend={sendMessage}
          themeColor={config.themeColor}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
