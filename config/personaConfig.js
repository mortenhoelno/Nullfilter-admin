// 🆕 NY FIL: config/personaConfig.js
// Inneholder alt som er unikt for hver chatbot: navn, avatar, bobler, farge osv.

const personaConfig = {
  nullfilter: {
    name: "Digital Morten – Null Filter",
    description:
      "Jeg er her for deg – når som helst. En digital versjon av meg (Morten) som svarer så nært jeg kan som den ekte meg ville gjort.",
    avatar: "/avatar-nullfilter.png",
    disclaimer:
      "❗ Dette er ikke medisinsk hjelp eller akutt krisehjelp. Hvis du er i fare eller har selvmordstanker, kontakt legevakt på 116 117 eller ring 113.",
    themeColor: "blue",
    starters: [
      "Jeg orker ikke være sosial",
      "Ingenting virker",
      "Ingen bryr seg om meg",
      "Hvordan gå ned i vekt og bli der",
      "Hvorfor er jeg alltid sliten og umotivert",
    ],
    intro: "Hei! Jeg er Null Filter. Hva vil du prate om i dag?",
  },

  keepertrening: {
    name: "Keepertrening – Mental styrke",
    description:
      "Her trener vi mer enn reflekser. Jeg hjelper deg tenke som en proff.",
    avatar: "/avatar-keepertrening.png",
    disclaimer: null, // ingen varsling
    themeColor: "green",
    starters: [
      "Hvordan får jeg mer selvtillit i mål?",
      "Jeg blir nervøs før kamp",
      "Hvordan trener jeg mental styrke?",
      "Hvordan takle tabber uten å miste fokus?",
      "Jeg føler at treneren ikke har tro på meg",
    ],
    intro: "Hei, keeper! Klar for å trene både kropp og hode? 💪🧠",
  },
};

export default personaConfig;
