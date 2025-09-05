// components/ChatEngine.js — NY VERSJON med anti-spam på quick replies

import { useRef, useEffect, useState } from "react";

/**
 * @param {Object} props
 * @param {Array} props.messages
 * @param {string} props.input
 * @param {function} props.setInput
 * @param {function} props.onSend
 * @param {boolean} [props.loading]
 * @param {string} [props.themeColor] - f.eks. "blue" eller "green"
 * @param {Array} [props.suggestions] - forslag til spørsmål brukeren kan trykke på
 */
export default function ChatEngine({
  messages,
  input,
  setInput,
  onSend,
  loading = false,
  themeColor = "blue",
  suggestions = [],
}) {
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const [waitingMessage, setWaitingMessage] = useState(null);
  const [displayedText, setDisplayedText] = useState(""); // typing-effekt
  const [fadeOut, setFadeOut] = useState(false);

  // Scroll til bunnen når nye meldinger kommer
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Ventemeldinger
  const waitMessages = [
    "Jeg samler de beste innsiktene for deg... ⏳",
    "Jobber med å finne det perfekte svaret 🔍",
    "Analyserer all tilgjengelig kunnskap for deg...",
    "Lager et skreddersydd svar basert på alt jeg vet ✨",
    "Setter sammen de mest relevante detaljene...",
    "Kvalitet tar tid - jobber med ditt svar 💭",
    "Gjennomgår omfattende kunnskap for best mulig svar...",
    "Tenker grundig for å gi deg mest verdi 🧠",
    "Kobler sammen innsikter for ditt unike behov...",
    "Utarbeider et gjennomtenkt svar til deg ⚡",
  ];

  // Når loading starter → velg melding og skriv bokstav-for-bokstav
  useEffect(() => {
    if (loading) {
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
      setDisplayedText("");
      setFadeOut(false);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(msg.slice(0, i)); // bokstav for bokstav
        if (i >= msg.length) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    } else if (waitingMessage) {
      // Fade ut når boten har svart ferdig
      setFadeOut(true);
      const timer = setTimeout(() => {
        setWaitingMessage(null);
        setDisplayedText("");
        setFadeOut(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const colorMap = {
    blue: {
      user: "bg-blue-100 text-blue-900",
      bot: "bg-gray-100 text-gray-800",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    green: {
      user: "bg-green-100 text-green-900",
      bot: "bg-gray-100 text-gray-800",
      button: "bg-green-600 hover:bg-green-700",
    },
  };
  const theme = colorMap[themeColor] || colorMap.blue;

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      {/* Meldingsvindu */}
      <div
        ref={listRef}
        className="flex-1 bg-white border rounded-md p-4 shadow-sm overflow-y-auto space-y-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-3 py-2 rounded-2xl text-sm shadow max-w-[85%] whitespace-pre-wrap ${
                m.role === "user" ? theme.user : theme.bot
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* Ventemelding */}
        {waitingMessage && (
          <div className="flex justify-start">
            <div
              className={`
                text-sm italic text-gray-500 transition-opacity duration-600
                ${fadeOut ? "opacity-0" : "opacity-80"}
              `}
            >
              {displayedText}
              <span className="animate-pulse">|</span>
            </div>
          </div>
        )}

        {/* Quick replies */}
        {suggestions.length > 0 && !fadeOut && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => !loading && onSend(s)} // 🔒 låst når loading=true
                disabled={loading}
                className={`px-3 py-1 rounded-full text-sm shadow ${
                  loading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Inputfelt */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          className="flex-1 border px-3 py-2 rounded"
          placeholder="Skriv en melding..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <button
          onClick={onSend}
          className={`px-4 py-2 rounded text-white ${theme.button}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
