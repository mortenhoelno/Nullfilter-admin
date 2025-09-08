// utils/modelConfig.ts
import type { TiktokenModel } from "tiktoken/model";

// Modell-navn til fallback som tiktoken støtter
export const MODEL_ENCODER_MAP: Record<string, TiktokenModel> = {
  "gpt-5-mini": "gpt-4",
  "gpt-5": "gpt-4",
  "gpt-4o": "gpt-4",
  "gpt-4": "gpt-4",
  "gpt-4-mini": "gpt-3.5-turbo",
  "gpt-3.5-turbo": "gpt-3.5-turbo",
};

// Maks tokens (prompt + completion)
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "gpt-5-mini": 8192,
  "gpt-4": 8192,
  "gpt-4o": 128000,
  "gpt-3.5-turbo": 4096,
};
