// components/ChatEngine.js — FIX for spacing + avsnitt + leselighet

import { useRef, useEffect, useState } from "react";
import { createClientPerf } from "../utils/clientPerf";

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
  const textareaRef = useRef(null);

  const [waitingMessage, setWaitingMessage] = useState(null);
  const [displayedText, setDisplayedText] = useState("");
  const [fadeOut, setFadeOut] = useState(false);
  const [quickReplyCount, setQuickReplyCount] = useState(0);

  const perfRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const waitMessages = [
    "Jeg samler de beste innsiktene for deg",
    "Jobber med å finne det perfekte svaret",
    "Analyserer kunnskapen jeg har tilgjengelig",
    "Setter sammen noe skreddersydd for deg",
    "Tenker grundig for å gi deg mest verdi",
  ];

  useEffect(() => {
    if (loading) {
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
      setDisplayedText("");
      setFadeOut(false);

      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(msg.slice(0, i));
        if (i >= msg.length) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    } else if (waitingMessage) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setWaitingMessage(null);
        setDisplayedText("");
        setFadeOut(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

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

  // --- FIX: mellomrom når vi streamer tekst ---
  const safeAppend = (prev, next) => {
    if (!prev) return next;
    const needsSpace =
      !prev.endsWith(" ") && !next.startsWith(" ") && /[a-zA-Z0-9]/.test(prev.slice(-1));
    return prev + (needsSpace ? " " : "") + next;
  };

  const handleSend = (text) => {
    if (loading) return;
    perfRef.current = createClientPerf("chat");
    perfRef.current.onSendClick();

    onSend(text, {
      onRequestStart: () => perfRef.current?.onRequestStart(),
      onDone: (extra) => {
        const result = perfRef.current?.onDone(extra);
        console.log("⏱️ Ferdig response_ms:", result?.response_ms);
        return result?.response_ms;
      },
      onDelta: (delta) => {
        // brukes hvis du streamer inn tekst
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            const updated = {
              ...last,
              content: safeAppend(last.content, delta),
            };
            return [...prev.slice(0, -1), updated];
          } else {
            return [...prev, { role: "assistant", content: delta }];
          }
        });
      },
    });
  };

  const handleQuickReply = (s) => {
    if (loading) return;
    if (quickReplyCount >= 3) {
      onSend("Hei, skriver du eller har du sovnet på tastaturet? 😅");
      setQuickReplyCount(0);
      return;
    }
    setQuickReplyCount((c) => c + 1);
    handleSend(s);
  };

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
              className={`px-3 py-2 rounded-2xl text-sm shadow max-w-[85%] overflow-hidden whitespace-pre-wrap break-words ${
                m.role === "user" ? theme.user : theme.bot
              }`}
            >
              {/* 👇 Gjør om \n\n til avsnitt og \n til <br /> */}
              {m.content
                .split(/\n\n+/)
                .map((para, idx) => (
                  <p key={idx} className="mb-2">
                    {para.split(/\n/).map((line, lineIdx) => (
                      <span key={lineIdx}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </p>
                ))}
            </div>
          </div>
        ))}

        {/* Typing-indikator */}
        <div className="min-h-[24px] flex items-center">
          {waitingMessage && (
            <div
              className={`text-sm italic text-gray-500 transition-opacity duration-600 ${
                fadeOut ? "opacity-0" : "opacity-80"
              }`}
            >
              {displayedText}
              <span className="ml-1 animate-pulse">…</span>
            </div>
          )}
        </div>

        {/* Quick replies */}
        {suggestions.length > 0 && !fadeOut && (
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleQuickReply(s)}
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
        <textarea
          ref={textareaRef}
          className="flex-1 border px-3 py-2 rounded resize-none overflow-hidden max-h-32"
          placeholder="Skriv en melding..."
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${theme.button} ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
