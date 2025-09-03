// FERDIG VERSJON: pages/chat-nullfilter/index.js med ChatEngine

import { useState, useEffect } from "react";
import { createConversation, saveMessage } from "../../utils/storage";
import ChatEngine from "../../components/ChatEngine";
/** @typedef {import('../../types').Message} Message */
/** @typedef {import('../../types').Conversation} Conversation */

export default function NullFilterChat() {
  const [useMemory, setUseMemory] = useState(false);
  const [email, setEmail] = useState("");
  const [consentToFollowUp, setConsentToFollowUp] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hei! Jeg er Null Filter. Hva vil du prate om i dag?" },
  ]);

  useEffect(() => {
    if (useMemory && email && !conversation) {
      const conv = createConversation(email);
      setConversation(conv);
    }
  }, [useMemory, email]);

  const starterMessages = [
    "Jeg orker ikke være sosial",
    "Ingenting virker",
    "Ingen bryr seg om meg",
    "Hvordan gå ned i vekt og bli der",
    "Hvorfor er jeg alltid sliten og umotivert",
  ];

  const appendBotPlaceholder = () => {
    const reply = {
      role: "assistant",
      content: "(Jeg tenker høyt sammen med deg – dette byttes ut senere med faktisk svar)",
    };
    setMessages((prev) => [...prev, reply]);
    if (conversation) saveMessage(conversation.id, reply);
  };

  const sendMessage = (text) => {
    const toSend = (text ?? chatInput).trim();
    if (!toSend) return;

    const newMessage = { role: "user", content: toSend };
    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");
    if (conversation) saveMessage(conversation.id, newMessage);

    setTimeout(() => appendBotPlaceholder(), 400);
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
            src="/avatar-nullfilter.png"
            alt="Digital Morten"
            className="w-32 h-32 rounded-full border border-gray-300 shadow"
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold">🧠 Digital Morten – Null Filter</h1>
          <p className="mt-2 text-gray-600">
            Jeg er her for deg – når som helst. En digital versjon av meg (Morten)
            som svarer så nært jeg kan som den ekte meg ville gjort.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded-md text-sm">
          <p>
            ❗ Dette er ikke medisinsk hjelp eller akutt krisehjelp. Hvis du er i fare eller har selvmordstanker,
            kontakt legevakt på 116 117 eller ring 113.
          </p>
        </div>

        {/* Brukertypevalg */}
        <div className="space-y-2">
          <p className="font-medium">Hvordan vil du bruke chatboten?</p>
          <label className="flex items-center gap-2">
            <input type="radio" name="memory" checked={!useMemory} onChange={() => setUseMemory(false)} />
            Anonym (ingenting lagres)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="memory" checked={useMemory} onChange={() => setUseMemory(true)} />
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
            {starterMessages.map((msg, idx) => (
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
          themeColor="blue"
        />
      </div>
    </div>
  );
}
