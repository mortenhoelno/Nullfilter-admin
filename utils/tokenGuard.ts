// utils/tokenGuard.ts
import { encoding_for_model } from "tiktoken";
import { MODEL_ENCODER_MAP, MODEL_TOKEN_LIMITS } from "./modelConfig";

type TokenGuardInput = {
  systemPrompt: string;
  userPrompt: string;
  contextChunks?: string[];
  historyMessages?: string[];
  replyMax: number;
  model?: string;
};

const encoderCache = new Map<string, ReturnType<typeof encoding_for_model>>();

function getEncoder(model: string): ReturnType<typeof encoding_for_model> {
  const fallback = MODEL_ENCODER_MAP[model] || "gpt-3.5-turbo";
  if (encoderCache.has(fallback)) return encoderCache.get(fallback)!;

  const enc = encoding_for_model(fallback);
  encoderCache.set(fallback, enc);
  return enc;
}

function estimateTokens(text: string, enc: ReturnType<typeof encoding_for_model>): number {
  return enc.encode(text).length;
}

export function tokenGuard(input: TokenGuardInput) {
  const {
    systemPrompt,
    userPrompt,
    contextChunks = [],
    historyMessages = [],
    replyMax,
    model = "gpt-5-mini",
  } = input;

  const enc = getEncoder(model);
  const maxTokens = MODEL_TOKEN_LIMITS[model] || 4096;

  const systemTokens = estimateTokens(systemPrompt, enc);
  const userTokens = estimateTokens(userPrompt, enc);
  const contextTokens = contextChunks.map((chunk) => estimateTokens(chunk, enc));
  const historyTokens = historyMessages.reduce((sum, msg) => sum + estimateTokens(msg, enc), 0);

  let total = systemTokens + userTokens + historyTokens + replyMax;
  let includedChunks: string[] = [];
  let overflow = 0;

  for (let i = 0; i < contextChunks.length; i++) {
    const tokenCount = contextTokens[i];
    if (total + tokenCount > maxTokens) {
      overflow = total + tokenCount - maxTokens;
      break;
    }
    total += tokenCount;
    includedChunks.push(contextChunks[i]);
  }

  return {
    isValid: overflow === 0,
    total,
    overflow,
    modelUsed: model,
    encoderUsed: MODEL_ENCODER_MAP[model],
    includedChunks,
    droppedChunks: contextChunks.slice(includedChunks.length),
  };
}
