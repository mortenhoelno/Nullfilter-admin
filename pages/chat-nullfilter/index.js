import { useState } from "react";
import ChatEngine from "../../components/ChatEngine";
import personaConfig from "../../config/personaConfig";

export default function NullfilterChat() {
  const config = personaConfig.nullfilter;
  const [loading, setLoading] = useState(false);

  async function sendMessage(message, history) {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: "nullfilter",
          message,
          history,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API feilet: ${res.status}`);
      }

      const data = await res.json();
      return {
        role: "assistant",
        content: data.reply || "(ingen respons)",
      };
    } catch (err) {
      console.error("sendMessage error:", err);
      return {
        role: "assistant",
        content: "(Teknisk feil – prøv igjen senere)",
      };
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatEngine
      title={config.name}
      intro={config.intro}
      starters={config.starters}
      sendMessage={sendMessage}
      loading={loading}
    />
  );
}
