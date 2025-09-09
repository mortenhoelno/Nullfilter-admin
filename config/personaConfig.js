// config/personaConfig.js
// Én sann kilde for persona-oppsett: modell, temperatur, systemPrompt og token-budsjett.
// Brukes av både /api/chat og /api/rag/chat (og PromptStudio-komponenter hvis ønskelig).

/**
 * Hver persona bør ha:
 * - model:        primærmodell (f.eks. "gpt-5-mini" eller "gpt-4o")
 * - temperature:  0.0–1.0 (lav = mer deterministisk)
 * - systemPrompt: stemme/rammer for boten
 * - tokenBudget:  { pinnedMax, ragMax, replyMax } (alle verdier i tokens)
 *
 * Tips til justeringer:
 * - øk replyMax for lengre svar
 * - øk ragMax hvis du vil ha mer kontekst (RAG)
 * - pinnedMax kan brukes hvis du pinner persona-tekst/faste instruksjoner
 */

const personaConfig = {
  // NullFilter – mental helse
  nullfilter: {
    id: "nullfilter",
    name: "NullFilter",
    model: "gpt-4o",
    temperature: 0.2,
    systemPrompt: [
      "Du er NullFilter – varm, støttende og konkret.",
      "Svar tydelig og kortfattet først; utforsk detaljer ved behov.",
      "Er du usikker, si det ærlig og foreslå neste steg.",
      "Unngå medisinske råd — veiled mot profesjonell hjelp der relevant.",
    ].join("\n"),
    tokenBudget: {
      pinnedMax: 800,   // plass til persona/rammer
      ragMax: 3000,     // kontekst fra dokumenter (RAG)
      replyMax: 1200,   // maks for selve svaret
    },
    // Valgfrie flags dersom du ønsker å styre adferd i UI:
    flags: {
      fallbackEnabled: true,   // tillat modell-fallback i /api/rag/chat
    },
  },

  // Keepertrening – idrett
  keepertrening: {
    id: "keepertrening",
    name: "Keepertrening",
    model: "gpt-4o",
    temperature: 0.25,
    systemPrompt: [
      "Du er en fotballkeeper-trener – positiv, presis og praktisk.",
      "Gi trinnvise råd med tydelig progresjon og fokus på sikkerhet.",
      "Skriv på norsk, med korte setninger og konkrete øvelser.",
    ].join("\n"),
    tokenBudget: {
      pinnedMax: 600,
      ragMax: 2500,
      replyMax: 900,
    },
    flags: {
      fallbackEnabled: true,
    },
  },

  // Eksempel-persona for eksperimenter
  lab: {
    id: "lab",
    name: "Lab (Eksperiment)",
    model: "gpt-5-mini",
    temperature: 0.3,
    systemPrompt: [
      "Du er en nøytral assistent for interne eksperimenter.",
      "Hold en faglig, rolig tone. Vis resonnement kun hvis eksplisitt bedt om det.",
      "Når informasjon mangler, foreslå hvordan vi kan finne den.",
    ].join("\n"),
    tokenBudget: {
      pinnedMax: 500,
      ragMax: 2000,
      replyMax: 1000,
    },
    flags: {
      fallbackEnabled: true, // f.eks. til gpt-4o-mini via llmClient
    },
  },
};

export default personaConfig;
