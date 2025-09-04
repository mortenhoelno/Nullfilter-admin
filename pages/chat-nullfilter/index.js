// FERDIG VERSJON: pages/chat-nullfilter/index.js
// NullFilter-chat med minne, RAG og hel kontekst

import { useState, useEffect } from "react";
import {
  createConversation,
  saveMessage,
  getConversationByEmail,
} from "../../utils/storage";
import { getRagContext } from "../../utils/rag";
import ChatEngine from "../../components/ChatEngine";
import personaConfig from "../../config/personaConfig";

/** @typedef {import('../../types').Message} Message */
/** @typedef {import('../../types').Conversation} Conversation */

const config = personaConfig.nullfilter;

export default function NullFilterChat() {
  const [useMemory, setUseMemory] = useState(false);
  const [email, setEmail] = useState("");
  const [consentToFollowUp, setConsentToFollowUp] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: config.intro },
  ]);
  const [loading, setLoading] = useState(false);

  // 🚀 Hent eksisterende samtale hvis memory er på
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

  // 🚀 Send melding + bruk hele historikken
  const sendMessage = async (text) => {
    const toSend = (text ?? chatInput).trim();
    if (!toSend) return;

    const userMessage = { role: "user", content: toSend };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    if (conversation) await saveMessage(conversation.id, userMessage);

    setLoading(true);

    // 🔍 Hent RAG-kontekst
    const { contextText } = await getRagContext(toSend);

    const systemPrompt = `
Du er ${config.name} – varm, klok og ekte.
Bruk konteksten under når du svarer. Ikke gjett. Si ifra hvis noe mangler.

${contextText ? `\nRelevante utdrag:\n${contextText}\n` : ""}
    `;

    // 👉 Nå sender vi hele historikken videre
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
      userMessage,
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullMessages, personaId: config.slug }),
      });

      const data = await res.json();
      const reply = {
        role: "assistant",
        content: data.reply || "Beklager, jeg klarte ikke svare akkurat nå.",
      };

      setMessages((prev) => [...prev, reply]);
      if (conversation) await saveMessage(conversation.id, reply);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "En feil oppsto under samtalen. Prøv igjen senere.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStarterClick = (msg) => {
    setChatInput(msg);
    sendMessage(msg);
  };

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
              Send meg en hyggelig oppfølging på e-post etter samtalen
            </label>
          )}
        </div>

        {/* Startbobler */}
        <div className="space-y-2">
          <p className="font-medium">Hva vil du snakke om? Trykk på en boble:</p>
          <div className="flex flex-wrap gap-2">
            {config.starters.map((msg, idx) => (
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
          loading={loading}
          themeColor={config.themeColor}
        />
      </div>
    </div>
  );
}
