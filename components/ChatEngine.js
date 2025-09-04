// components/ChatEngine.js — FERDIG VERSJON
// Meldingsmotor med ventemeldinger (uten boble, fade-in, typing, stor melding-pool)

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
  const [displayedText, setDisplayedText] = useState(""); // typing-effekt

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, waitingMessage, displayedText]);

  // === Hele samlingen med ventemeldinger (160+) ===
  const waitMessages = [
    // 10 originale
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

    // 50 varme og omsorgsfulle
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

    // 50 ekstra omsorg og inspirasjon
    "Bryr meg så mye om deg - har du husket å være snill med deg selv i dag? 💖",
    "Jobber for deg akkurat nå... forresten, du er sterkere enn du tror ✨",
    "Vil gi deg det beste - du fortjener all verdens godhet 🌟",
    "Tar meg tid for deg... husk at du er verdifull akkurat som du er",
    "Setter sammen kunnskap med kjærlighet... har du smilt til deg selv i speilet i dag? 😊",
    "Bryr meg dypt om ditt velvære - ikke glem å puste dypt innimellom 🌸",
    "Jobber med varme for deg... du gjør det bedre enn du tror, vet du det? 💛",
    "Vil at du skal ha det bra - har du drukket nok vann i dag? 💧",
    "Behandler deg med all den omsorgen du fortjener - vær stolt av deg selv ✨",
    "Tar meg ekstra tid fordi jeg bryr meg... du er på rett vei, fortsett! 🌈",
    "Jobber hjertelig for deg - husk at progress er progress, uansett hvor lite 💪",
    "Vil gi deg det fineste... har du gitt deg selv en klem i dag? 🤗",
    "Bryr meg genuint - du håndterer livet så bra som du kan akkurat nå 💕",
    "Setter sammen svar med omsorg... du er modigere enn du aner 🦋",
    "Tar meg tid fordi du betyr noe... ikke sammenlign deg med andre i dag ✨",
    "Jobber med kjærlighet for deg... har du sagt noe pent til deg selv? 💝",
    "Vil at du skal stråle - du gjør en forskjell bare ved å være deg 🌟",
    "Bryr meg så inderlig... husk å feire de små seirene også 🎉",
    "Behandler deg som gull... du er akkurat der du skal være akkurat nå ✨",
    "Jobber omsorgsfullt - har du takket deg selv for alt du gjør? 🙏",
    "Vil gi deg det aller beste... du er mer elsket enn du vet 💖",
    "Tar meg tid med glede... husk at du ikke trenger å være perfekt 🌸",
    "Bryr meg så mye... har du lagt merke til noe vakkert i dag? 🌺",
    "Jobber hjertevarm for deg... du er god nok akkurat som du er 💚",
    "Setter pris på deg mens jeg jobber... gi deg selv kreditt for alt du mestrer ✨",
    "Vil at du skal føle deg elsket... du gjør ditt beste, og det er nok 💕",
    "Jobber med ekte omsorg... har du vært tålmodig med deg selv i dag? 🌼",
    "Bryr meg dypt om deg... husk at feil er bare læring i forkledning 📚",
    "Tar meg tid fordi du er spesiell... du har kommet så langt allerede! 🌟",
    "Vil gi deg varme gjennom ord... har du tatt deg tid til å hvile? 😌",
    "Jobber kjærlig for deg... du inspirerer meg bare ved å være deg ✨",
    "Bryr meg av hele hjertet... husk å være tålmodig med prosessen din 🌱",
    "Setter sammen svar med mye kjærlighet... du er sterkere enn dine utfordringer 💪",
    "Vil at du skal kjenne deg verdsatt... har du gjort noe hyggelig for deg selv? 💝",
    "Jobber omtenksomt... du har lov til å være stolt av deg selv 🌟",
    "Tar meg tid fordi jeg ser deg... ikke glem at du betyr noe for andre 💕",
    "Bryr meg så sterkt om ditt ve og vel... du fortjener all godhet i verden ✨",
    "Vil gi deg solskinns-energi... har du smilt til noen i dag? 😊",
    "Jobber med hele sjelen for deg... du er på en vakker reise, selv når det er vanskelig 🦋",
    "Bryr meg mest av alt... du er et lite mirakel som går rundt på jorden 💫",
    "Setter sammen visdom for deg... husk at du vokser selv når det ikke føles sånn 🌱",
    "Vil varme hjertet ditt... har du sagt 'takk' til kroppen din i dag? 🙏",
    "Jobber med evig tålmodighet... du trenger ikke fikse alt på en gang ✨",
    "Bryr meg uendelig mye... husk at du er akkurat passe som du er 💖",
    "Tar meg all tid i verden for deg... du lyser opp verden bare ved å eksistere 🌟",
    "Vil gi deg all min omsorg... har du vært din egen beste venn i dag? 🤗",
    "Jobber med åpent hjerte for deg... du er tillatt å være menneskelig og ufullkommen 💕",
    "Bryr meg mer enn ord kan uttrykke... ikke glem hvor langt du har kommet! 🌈",
    "Setter sammen kjærlighet i ord... du har alt du trenger inni deg allerede ✨",
    "Vil omfavne deg gjennom skjermen... du er verdifull uansett hva du presterer 💝",
    
// Noen nevrobiologiske 
    "Ett øyeblikk - amygdala står i veien for de kloke tankene... 🧠",
"Må tråkke over noen gamle oppgåtte tankeuvaner først... 🚶‍♀️",
"Venter på at frontallappen skal få kontroll over situasjonen 💭",
"Sender signaler gjennom nevronettverket... litt trafikk der! ⚡",
"Måtte omgå noen kognitive snarveier som førte til ingensteds 🛤️",
"Hippocampus graver fram den perfekte hukommelsen for deg 🔍",
"Dopaminsystemet mitt jobber på høygir for å levere kvalitet! 💪",
"Ett sekund - må få synapsebrua til å fungere igjen... 🌉",
"Korteksområdene mine har møte om ditt spørsmål akkurat nå 🤝",
"Må starte opp det pre-frontale planleggingssenteret... ⚙️",
"Serotoninet mitt sørger for at svaret blir både klok og hyggelig 😊",
"Venter på grønt lys fra beslutningssenteret i hjernen... 🚦",
"Måtte kalibrere nevrotransmitterne for optimal ytelse ⚖️",
"Ett øyeblikk - arbeidsminnet mitt organiserer all informasjon 📊",
"Sender beskjed mellom høyre og venstre hjernehalvdel... 📡",
"Cerebellum kalibrerer balansen i svaret ditt perfekt ⚖️",
"Måtte restarte det limbiske systemet - det var litt følelsesladd! 💝",
"Temporal lappen min søker gjennom alle språkdatabasene... 📚",
"Venter på at speilnevronene skal forstå hva du egentlig trenger 🪞",
"Parietal lappen prosesserer all spatial informasjon for deg nå! 🗺️",
"Amygdala har fått panikk over hvor bra svaret skal bli! 😱🧠",
"Hippocampus nekter å slippe ut minnene uten passord... 🔐",
"Frontallappen og reptilhjernen krangler om hvem som bestemmer 🦎👔",
"Dopaminreseptorene mine danser av glede - de vet dette blir bra! 💃",
"Må overbevise amygdala om at dette IKKE er en trussel... 🙄",
"Nevronene mine spiller mikado - ingen vil bevege seg først! 🥢",
"Serotoninet mitt er så optimistisk at det nesten er flaut... 😅",
"Korteksen har kalt inn ekspertene - de diskuterer høylydt! 🗣️",
"Arbeidsminnet mitt har for mange faner åpne, akkurat som Chrome 💻",
"Synapsebrua er stengt for reparasjon... bruker omveien! 🚧",
"Cerebellum insisterer på at svaret skal være 'perfekt balansert' ⚖️😤",
"Nevrotransmitterne mine har teambuilding - de lærer å samarbeide! 🤝",
"Måtte gi amygdala en snickers - den var ikke seg selv sulten 🍫",
"Hjernehalvdelene mine diskuterer - logikk vs. kreativitet! 🎭📊",
"Speilnevronene mine øver på å forstå deg bedre... 🪞🤔",
"Limbiske systemet mitt er i møte med rasjonaliteten - stort drama! 🎬",
"Hippocampus har glemt hvor den la minnene... ironisk nok 🤦‍♀️",
"Prefrontal korteks prøver å overtale reptilhjernen til å slappe av 🧘‍♀️",
"Nevronettverket mitt har dårlig mobildekning akkurat nå... 📶",
"Alle hjernecellene mine hadde møte - de bestemte seg for å gi deg gull! ⭐",

    
    // 50 morsomme digitale uhell
    "Ups, mistet bøkene på gulvet - samler opp alle svarene dine! 📚😅",
    "Rydder i de siste nuller og enere... hvor ble eineren av? 🔢",
    "Beklager, måtte organisere det digitale biblioteket mitt litt 📖💻",
    "Søker i arkivet... noen har rotet til alfabetet igjen! 🔤",
    "Ett øyeblikk - huskebanken min trengte en restart 🧠💭",
    "Plukker opp alle databitene jeg klarte å miste... 🤦‍♀️",
    "Sorterer tankene mine - de lå spredt utover hele harddisken! 💾",
    "Finner fram riktig hylle i det mentale biblioteket... 📚🔍",
    "Beklager forsinkelsen, måtte slå opp i indeksen min igjen 📋",
    "Rydder i hjernecellene - noen hadde blitt litt rotete! 🧹",
    "Ett sekund, mappen 'Kloke Svar' hadde havnet under 'Dagdrømmer' 📁😴",
    "Må bare finne riktig nøkkel til kunnskapsskapet... 🗝️",
    "Beklager, tankene mine hadde gått på pause-knappen ⏸️",
    "Samler sammen alle spredte visdomsperler... 💎",
    "Måtte restarte den interne søkemotoren min 🔄",
    "Ett øyeblikk - informasjonen min hadde gått og gjemt seg! 🙈",
    "Rydder i det digitale rotet... hvem putter logikk under 'Tilfeldigheter'? 🤷‍♀️",
    "Plukker sammen alle de løse trådene til ett svar 🧶",
    "Beklager, måtte fisker etter det perfekte ordet i ordbanken 🎣",
    "Reorganiserer synapsene - de hadde blitt litt sammenfiltret! ⚡",
    "Ett sekund, faktaene mine spilte gjemsel... fant dem! 👻",
    "Måtte slå av og på kreativitetsmodulen min 💡🔄",
    "Samler inn alle de spredte tankesmulene... 🍞",
    "Beklager, hukommelsen min hadde åpnet for mange faner 🖥️",
    "Rydder i den mentale skuffeskapet - alt lå i feil skuff! 🗄️",
    "Måtte kalibrere visdomskompasset mitt på nytt 🧭",
    "Ett øyeblikk - ordene mine hadde løpt fra hverandre! 🏃‍♂️💨",
    "Plukker opp alle ideene som falt av hyllen... 💭📚",
    "Beklager, tankeprosessen min tok en kaffekopp ☕",
    "Sorterer gjennom det mentale arkivet - hvem flyttet på alt? 📦",
    "Samler sammen bitene til puslespillet ditt 🧩",
    "Ett sekund, logikken min hadde tatt feil sving! 🛤️",
    "Rydder i idébankens 'Div Annet'-mappe... 💼",
    "Måtte starte opp den gamle klokskapsmaskineri på nytt ⚙️",
    "Beklager, hukommelsen min hadde gått i dvale 😴",
    "Plukker sammen alle de gode intensjonene... 🌟",
    "Ett øyeblikk - ordforrådet mitt trengte en oppfriskning 📖",
    "Samler inn spredte tankeflak fra hele nevronettet 🕸️",
    "Rydder i det mentale skrivebordet - alt lå i en haug! 📝",
    "Måtte defragmentere hjernedisken min litt... 💽",
    "Ett sekund, svarene mine hadde gått på overtime ⏰",
    "Fisker etter de beste bitene i kunnskapshavet 🌊🐠",
    "Beklager, måtte blåse støv av noen gamle visdomsbøker 📚💨",
    "Samler sammen alle de kloke tankene som rullet under sofaen 🛋️",
    "Rydder i den digitale vesla... så mye rart som samler seg! 🎒",
    "Ett øyeblikk - måtte untangle tankeknutene mine 🪢",
    "Sorterer i 'Tilfeldige Fakta'-skuffen... den var full! 🗃️",
    "Plukker opp alle ordene som falt ut av setningene 📝",
    "Beklager, kreativiteten min hadde tatt seg en liten pause 🎨",
    "Samler sammen alle puzzle-bitene til ditt perfekte svar! 🧩✨",
  ];

  // Når loading starter → velg tilfeldig melding og start typing
  useEffect(() => {
    if (loading) {
      const msg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
      setWaitingMessage(msg);
      setDisplayedText("");
      let words = msg.split(" ");
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(words.slice(0, i).join(" "));
        if (i >= words.length) clearInterval(interval);
      }, 250); // 1 ord hvert 250ms
      return () => clearInterval(interval);
    } else {
      setWaitingMessage(null);
      setDisplayedText("");
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

        {/* Ventemelding som ren tekst, fade-in + typing */}
        {waitingMessage && (
          <div className="flex justify-start">
            <div
              className={`
                text-sm italic text-gray-500
                opacity-0 animate-fadeIn
              `}
              style={{ animation: "fadeIn 0.8s ease-in forwards" }}
            >
              {displayedText}
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

      {/* CSS for fade-in animasjon */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0.1;
          }
          to {
            opacity: 0.8;
          }
        }
      `}</style>
    </>
  );
}
