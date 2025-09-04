// components/ChatEngine.js — FERDIG VERSJON
// Meldingsmotor med ventemeldinger (uten boble, fade-in/out, bokstav-for-bokstav typing, typing dots)

import { useRef, useEffect, useState } from "react";

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
  const [displayedText, setDisplayedText] = useState(""); // typing-effekt
  const [isFadingOut, setIsFadingOut] = useState(false);

  // auto-scroll bare når brukeren skriver (ikke på botsvar)
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight - 150;
      }
    }
  }, [messages]);

  // === bare 10 ventemeldinger nå (for rask build) ===
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

  // Når loading starter → velg melding
  useEffect(() => {
    if (loading) {
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
      setDisplayedText("");
      setIsFadingOut(false);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(msg.slice(0, i)); // bokstav for bokstav
        if (i >= msg.length) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    } else if (waitingMessage) {
      // fade ut når loading stopper
      setIsFadingOut(true);
      const t = setTimeout(() => {
        setWaitingMessage(null);
        setIsFadingOut(false);
      }, 800); // 0.8s fade-out
      return () => clearTimeout(t);
    }
  }, [loading]);

  const colorMap = {
    blue: {
      user: "bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    green: {
      user: "bg-green-100",
      button: "bg-green-600 hover:bg-green-700",
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

        {/* Ventemelding med fade-in/out, typing + dots */}
        {waitingMessage && (
          <div className="flex justify-center">
            <div
              className={`
                text-sm italic text-gray-500
                transition-opacity duration-800
                ${isFadingOut ? "opacity-0" : "opacity-80"}
              `}
            >
              {displayedText}
              <span className="typing-dots ml-1" />
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

      {/* CSS for fade + dots */}
      <style jsx>{`
        @keyframes blink {
          0%,
          80%,
          100% {
            opacity: 0;
          }
          40% {
            opacity: 1;
          }
        }
        .typing-dots::after {
          content: "…";
          animation: blink 1.2s infinite;
        }
      `}</style>
    </>
  );
}
