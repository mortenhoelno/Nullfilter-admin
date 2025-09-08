// utils/modelConfig.ts
// Enkel, robust mapping fra vilkårlige modellnavn (f.eks. "gpt-5-mini")
// til en encoder som tiktoken faktisk støtter. Ingen avhengighet til tiktoken-typer.

// Vi bruker string som "TiktokenModel" for å unngå type-trøbbel i build.
type TiktokenModel = string;

/**
 * Direkte mapping for kjente/forventede modelnavn → encoder som finnes i tiktoken.
 * Når tiktoken får egen encoder for nye modeller, kan disse oppdateres her.
 */
export const MODEL_ENCODER_MAP: Record<string, TiktokenModel> = {
  // 5.x – inntil tiktoken evt. får egne encodere, bruk gpt-4
  "gpt-5-mini": "gpt-4",
  "gpt-5o": "gpt-4",
  "gpt-5": "gpt-4",

  // 4.x-familien
  "gpt-4o": "gpt-4",
  "gpt-4o-mini": "gpt-4",
  "gpt-4": "gpt-4",
  "gpt-4-mini": "gpt-3.5-turbo",

  // 3.5-familien
  "gpt-3.5-turbo": "gpt-3.5-turbo",
};

/**
 * Finn beste tilgjengelige encoder for et gitt modellnavn.
 * - Eksakt treff i tabellen over vinner først.
 * - Ellers brukes familie-heuristikk (gpt-5→gpt-4, gpt-4→gpt-4, gpt-3.5→gpt-3.5-turbo).
 * - Til slutt faller vi tilbake til "gpt-3.5-turbo".
 */
export function resolveEncoderModel(model: string): TiktokenModel {
  const key = (model || "").toLowerCase();

  // Eksakt match
  if (MODEL_ENCODER_MAP[key]) return MODEL_ENCODER_MAP[key];

  // Familie-heuristikk for ukjente varianter (f.eks. "gpt-5-mini-2025")
  if (key.startsWith("gpt-5")) return "gpt-4";
  if (key.startsWith("gpt-4")) return "gpt-4";
  if (key.startsWith("gpt-3.5")) return "gpt-3.5-turbo";

  // Siste utvei
  return "gpt-3.5-turbo";
}
