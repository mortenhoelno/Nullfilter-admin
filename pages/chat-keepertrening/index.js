// 🆕 NY FIL: pages/chat-keepertrening/index.js
// Denne filen er startsiden for chatboten Keepertrening

import { useState, useRef, useEffect } from "react";
import { createConversation, saveMessage } from "../../utils/storage";
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

  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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

        <div
          ref={listRef}
          className="mt-6 bg-gray-50 border rounded-md p-4 shadow-sm max-h-[60vh] overflow-y-auto space-y-3"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-3 py-2 rounded-2xl text-sm shadow max-w-[85%] whitespace-pre-wrap ${
                  m.role === "user" ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            className="flex-1 border px-3 py-2 rounded"
            placeholder="Skriv en melding..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <button
            onClick={() => sendMessage()}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
