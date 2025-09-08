// utils/modelConfig.ts
// Riktig type-import fra 'tiktoken' (ikke 'tiktoken/model')
import type { TiktokenModel } from "tiktoken";

/**
 * Map fra "vilkårlig" modellnavn (f.eks. gpt-5-mini) til en encoder
 * som Tiktoken faktisk støtter. Når tiktoken oppdateres, kan disse pekes mer presist.
 */
export const MODEL_ENCODER_MAP: Record<string, TiktokenModel> = {
  // 4.x-familien
  "gpt-4": "gpt-4",
  "gpt-4o": "gpt-4",
  "gpt-4o-mini": "gpt-4",
  "gpt-4-mini": "gpt-3.5-turbo",

  // 3.5
  "gpt-3.5-turbo": "gpt-3.5-turbo",

  // 5.x – foreløpig fallback til gpt-4-encoder
  "gpt-5": "gpt-4",
  "gpt-5o": "gpt-4",
  "gpt-5-mini": "gpt-4",
};

/**
 * Normaliserer modellnavn og finner best tilgjengelige encoder i Tiktoken.
 * Fallback er 'gpt-3.5-turbo'.
 */
export function resolveEncoderModel(model: string): TiktokenModel {
  const key = (model || "").toLowerCase();
  if (MODEL_ENCODER_MAP[key]) return MODEL_ENCODER_MAP[key];

  // Familie-heuristikk for ukjente varianter
  if (key.startsWith("gpt-4")) return "gpt-4";
  if (key.startsWith("gpt-3.5")) return "gpt-3.5-turbo";
  if (key.startsWith("gpt-5")) return "gpt-4";

  return "gpt-3.5-turbo";
}
