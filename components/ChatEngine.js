// 🆕 NY FIL: components/ChatEngine.js
// Felles meldingsmotor med meldingsliste og input

import { useRef, useEffect } from "react";

/**
 * @param {Object} props
 * @param {Array} props.messages
 * @param {string} props.input
 * @param {function} props.setInput
 * @param {function} props.onSend
 * @param {string} [props.themeColor] - f.eks. "blue" eller "green"
 */
export default function ChatEngine({ messages, input, setInput, onSend, themeColor = "blue" }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-3 py-2 rounded-2xl text-sm shadow max-w-[85%] whitespace-pre-wrap ${
                m.role === "user" ? theme.user : "bg-gray-100"
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
    </>
  );
}
