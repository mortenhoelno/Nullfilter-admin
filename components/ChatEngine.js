// components/ChatEngine.js — FERDIG VERSJON
// Meldingsmotor med meldingsliste, input og ventemeldinger ("typing bubbles")

import { useRef, useEffect, useState } from "react";

/**
 * @param {Object} props
 * @param {Array} props.messages
 * @param {string} props.input
 * @param {function} props.setInput
 * @param {function} props.onSend
 * @param {boolean} [props.loading] - settes true når API-kall pågår
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

  // Ventemeldinger (10 originale + 50 varme/omsorgsfulle)
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
    "Tar meg ekstra tid fordi du fortjener det beste 💝",
    "Vil gi deg noe som virkelig betyr noe for deg...",
    "Bryr meg om at svaret skal hjelpe deg videre 🤗",
    "Jobber med omhu - ditt spørsmål er viktig for meg",
    "Gir deg min fulle oppmerksomhet akkurat nå 💕",
    "Ønsker at du skal føle deg forstått og hjulpet...",
    "Tar meg tid til å virkelig lytte til deg 👂",
    "Din tillit betyr alt - lager noe verdifullt...",
    "Vil at du skal gå herfra med nyttig kunnskap ✨",
    "Tenker på nettopp dine behov mens jeg jobber...",
    "Setter pris på din tålmodighet - det blir verdt det 🙏",
    "Behandler din forespørsel med den respekten den fortjener",
    "Vil ikke gi deg noe halvveis - du fortjener mer 💪",
    "Forstår at du venter, og det motiverer meg til å gi alt",
    "Din opplevelse er viktig for meg - jobber grundig...",
    "Bryr meg genuint om å hjelpe deg på best mulig måte 💫",
    "Tar ansvar for å gi deg noe som virkelig nytter",
    "Ønsker at du skal føle deg sett og forstått 🌟",
    "Jobber med kjærlighet til det jeg gjør for deg...",
    "Din situasjon fortjener en gjennomtenkt tilnærming",
    "Vil at du skal kjenne at jeg virkelig bryr meg 💖",
    "Tar meg tid fordi ditt spørsmål fortjener respekt",
    "Ønsker å gi deg trygghet gjennom godt innhold...",
    "Forstår viktigheten av det du spør om 🤝",
    "Jobber med empati og forståelse for din situasjon",
    "Vil at du skal føle deg godt ivaretatt her hos meg",
    "Din tilfredshet er min motivasjon akkurat nå 💗",
    "Behandler deg som den verdifulle personen du er",
    "Ønsker å være til ekte nytte i ditt liv...",
    "Tar meg tid fordi du har valgt å stole på meg",
    "Jobber med varme i hjertet for deg 💛",
    "Vil gi deg opplevelsen av å bli virkelig hjulpet",
    "Din velvære ligger meg på hjertet mens jeg jobber...",
    "Forstår at du trenger mer enn bare raske svar",
    "Ønsker å møte deg med omsorg og kompetanse 🌸",
    "Tar deg på alvor - derfor grundigheten",
    "Vil at du skal kjenne deg verdsatt og forstått",
    "Jobber med dedikasjon fordi du betyr noe 💚",
    "Ønsker å gi deg en opplevelse som varmer hjertet",
    "Tar meg tid fordi alle fortjener omtanke og kvalitet",
    "Holder deg i tankene mens jeg skaper noe spesielt...",
    "Vil at du skal føle deg trygg på at jeg gjør mitt beste",
    "Din historie fortjener et svar med substans 💙",
    "Jobber med tålmodighet fordi du viser meg tålmodighet",
    "Ønsker å være den hjelpen du virkelig trenger nå",
    "Forstår at bak spørsmålet er det et menneske som bryr seg",
    "Vil gi deg en opplevelse som føles personlig og varm 🌺",
    "Tar meg tid fordi kvalitet er min måte å vise omsorg",
    "Ønsker at du skal kjenne deg sett, hørt og hjulpet",
    "Jobber med hele hjertet for å gjøre en forskjell for deg 💕",
  ];

  useEffect(() => {
    if (loading) {
      // trekk tilfeldig melding når vi starter "tenkingen"
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
    } else {
      setWaitingMessage(null);
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

        {/* Ventemelding når loading = true */}
        {waitingMessage && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl text-sm shadow bg-gray-100 max-w-[85%] whitespace-pre-wrap italic text-gray-600">
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
    </>
  );
}
