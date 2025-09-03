// FERDIG VERSJON: pages/chat-keepertrening/index.js med ChatEngine

import { useState, useEffect } from "react";
import { createConversation, saveMessage } from "../../utils/storage";
import ChatEngine from "../../components/ChatEngine";
/** @typedef {import('../../types').Message} Message */
/** @typedef {import('../../types').Conversation} Conversation */

export default function KeeperChat() {
  const [useMemory, setUseMemory] = useState(false);
  const [email, setEmail] = useState("");
  const [consentToFollowUp, setConsentToFollowUp] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hei, keeper! Klar for å trene både kropp og hode? 💪🧠" },
  ]);

  useEffect(() => {
    if (useMemory && email && !conversation) {
      const conv = createConversation(email);
      setConversation(conv);
    }
  }, [useMemory, email]);

  const starterMessages = [
    "Hvordan får jeg mer selvtillit i mål?",
    "Jeg blir nervøs før kamp",
    "Hvordan trener jeg mental styrke?",
    "Hvordan takle tabber uten å miste fokus?",
    "Jeg føler at treneren ikke har tro på meg",
  ];

  const appendBotPlaceholder = () => {
    const reply = {
      role: "assistant",
      content: "(La oss jobbe med dette sammen – konkret tips kommer snart!)",
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
    <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Avatar + intro */}
        <div className="flex justify-center">
          <img
            src="/avatar-keepertrening.png"
            alt="KeeperBot"
            className="w-32 h-32 rounded-full border border-gray-300 shadow"
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold">🥅 Keepertrening – Mental styrke</h1>
          <p className="mt-2 text-gray-600">
            Her trener vi mer enn reflekser. Jeg hjelper deg tenke som en proff.
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
          themeColor="green"
        />
      </div>
    </div>
  );
}
