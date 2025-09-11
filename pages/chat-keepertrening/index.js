// FERDIG VERSJON: pages/chat-keepertrening/index.js
// Keepertrening-chat med responstid-logging + starter-fallback + ekte API-kall

import { useState, useEffect } from "react";
import {
  createConversation,
  saveMessage,
  getConversationByEmail,
} from "../../utils/storage";
import ChatEngine from "../../components/ChatEngine";
import personaConfig from "../../config/personaConfig";
/** @typedef {import('../../types').Message} Message */
/** @typedef {import('../../types').Conversation} Conversation */

const config = personaConfig.keepertrening;

export default function KeepertreningChat() {
  const [useMemory, setUseMemory] = useState(false);
  const [email, setEmail] = useState("");
  const [consentToFollowUp, setConsentToFollowUp] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: config.intro },
  ]);

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

  // 🚀 Send melding – med responstid-logging og ekte API-kall
  const sendMessage = async (text, perfCallbacks = {}) => {
    const toSend = (text ?? chatInput).trim();
    if (!toSend) return;

    const newMessage = { role: "user", content: toSend };
    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");
    if (conversation) await saveMessage(conversation.id, newMessage);

    try {
      perfCallbacks.onRequestStart?.();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: "keepertrening",
          messages: [...messages, newMessage], // 🔄 viktig: API forventer messages-array
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API feilet: ${res.status}`);
      }

      const data = await res.json();
      const reply = {
        role: "assistant",
        content: data.reply || "(ingen respons)",
      };

      setMessages((prev) => [...prev, reply]);

      const perfResult = perfCallbacks.onDone?.({});
      if (conversation) {
        await saveMessage(conversation.id, {
          ...reply,
          response_ms: perfResult ?? null,
        });
      }
    } catch (err) {
      console.error("sendMessage error:", err);
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

  // 🔄 Fallback hvis config.starters mangler
  const starters =
    config.starters && config.starters.length > 0
      ? config.starters
      : [
          "Hvordan kan jeg trene reaksjon?",
          "Hvordan forbedre spenst?",
          "Tips for kampforberedelse?",
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
                className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-full text-sm shadow"
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
        />
      </div>
    </div>
  );
}
