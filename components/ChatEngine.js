// components/ChatEngine.js — FERDIG VERSJON
// Meldingsmotor med ventemeldinger (pulsende fade, plassreservering)

import { useRef, useEffect, useState } from "react";

/**
 * @param {Object} props
 * @param {Array} props.messages
 * @param {string} props.input
 * @param {function} props.setInput
 * @param {function} props.onSend
 * @param {boolean} [props.loading] - true når API-kall pågår
 * @param {string} [props.themeColor] - f.eks. "blue" eller "green"
 */
export default function ChatEngine({
  messages,
  input,
  setInput,
  onSend,
  loading = false,
  themeColor = "blue",
}) {
  const listRef = useRef(null);
  const [waitingMessage, setWaitingMessage] = useState(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, waitingMessage]);

  // === Ventemeldinger (kort liste, du kan utvide) ===
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

  // Velg tilfeldig ventemelding når loading starter
  useEffect(() => {
    if (loading) {
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
    } else {
      // liten delay for smooth overgang
      const t = setTimeout(() => setWaitingMessage(null), 400);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const colorMap = {
    blue: {
      user: "bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700",
      text: "text-blue-800",
    },
    green: {
      user: "bg-green-100",
      button: "bg-green-600 hover:bg-green-700",
      text: "text-green-800",
    },
  };

  const theme = colorMap[themeColor] || colorMap.blue;

  return (
    <>
      <div
        ref={listRef}
        className="mt-6 bg-white border rounded-md p-4 shadow-sm max-h-[60vh] overflow-y-auto space-y-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-3 py-2 rounded-2xl text-sm shadow max-w-[85%] whitespace-pre-wrap ${
                m.role === "user" ? theme.user : "bg-gray-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* Ventemelding som fade-pulser mens vi venter */}
        {waitingMessage && (
          <div className="flex justify-start">
            <div
              className={`
                text-sm italic text-gray-500 animate-pulseFade
              `}
            >
              {waitingMessage}
            </div>
          </div>
        )}
      </div>

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

      {/* CSS for fade/pulse animasjon */}
      <style jsx>{`
        @keyframes pulseFade {
          0% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.9;
          }
          100% {
            opacity: 0.3;
          }
        }
        .animate-pulseFade {
          animation: pulseFade 1.8s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
