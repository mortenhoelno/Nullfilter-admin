// utils/tokenGuard.ts
// Fleksibel token-guard med trimming og modell-fallbacks.
// ⚠️ Bruk denne i API Routes med runtime "nodejs". tiktoken støttes ikke i Edge.
import { resolveEncoderModel } from "./modelConfig";

export type TokenGuardInput = {
  systemPrompt: string;
  userPrompt: string;
  contextChunks?: string[];
  historyMessages?: string[];
  maxTokens: number;
  replyMax: number;
  model?: string; // f.eks. gpt-5-mini
};

export type TokenGuardResult = {
  isValid: boolean;
  total: number;
  overflow: number;
  includedCount: number;
  includedTokens: number;
  droppedCount: number;
  droppedTokens: number;
  includedChunks: string[];
  droppedChunks: string[];
  breakdown: {
    system: number;
    user: number;
    history: number;
    context: number;
    replyMax: number;
  };
  meta: {
    model: string;
    encoderUsed: string; // hvilken encoder som ble brukt
  };
};

// Cache for encodere
const encoderCache = new Map<string, any>();

function getEncoder(model: string) {
  try {
    // Bruk eval('require') så Webpack/Vercel ikke prøver å bundle 'tiktoken'
    const req = eval("require") as NodeRequire;
    const { encoding_for_model } = req("tiktoken");
    const encModel = resolveEncoderModel(model);

    if (encoderCache.has(encModel)) {
      return { enc: encoderCache.get(encModel), encModel };
    }
    const enc = encoding_for_model(encModel);
    encoderCache.set(encModel, enc);
    return { enc, encModel };
  } catch {
    // Fallback – heuristikk (ca. 4.2 tegn per token)
    return {
      enc: {
        encode: (txt: string) =>
          Array.from({ length: Math.ceil((txt?.length ?? 0) / 4.2) }),
      },
      encModel: "heuristic",
    };
  }
}

export function estimateTokens(text: string, enc: any): number {
  if (!text) return 0;
  return enc.encode(text).length;
}

function trimToFit(params: {
  baseTokens: number;
  maxTokens: number;
  chunks: string[];
  chunkTokenCounts: number[];
}) {
  const { baseTokens, maxTokens, chunks, chunkTokenCounts } = params;
  let total = baseTokens;
  const included: string[] = [];
  const dropped: string[] = [];
  let includedTokens = 0;
  let droppedTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const t = chunkTokenCounts[i] || 0;
    if (total + t > maxTokens) {
      for (let j = i; j < chunks.length; j++) {
        dropped.push(chunks[j]);
        droppedTokens += chunkTokenCounts[j] || 0;
      }
      return { included, dropped, includedTokens, droppedTokens, total };
    }
    total += t;
    included.push(chunks[i]);
    includedTokens += t;
  }
  return { included, dropped, includedTokens, droppedTokens, total };
}

export function tokenGuard(input: TokenGuardInput): TokenGuardResult {
  const {
    systemPrompt,
    userPrompt,
    contextChunks = [],
    historyMessages = [],
    maxTokens,
    replyMax,
    model = "gpt-5-mini",
  } = input;

  const { enc, encModel } = getEncoder(model);

  const system = estimateTokens(systemPrompt, enc);
  const user = estimateTokens(userPrompt, enc);
  const history = historyMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg, enc),
    0
  );
  const ctxCounts = contextChunks.map((c) => estimateTokens(c, enc));

  const base = system + user + history + replyMax;
  const sumCtx = ctxCounts.reduce((a, b) => a + b, 0);
  const grand = base + sumCtx;

  if (grand <= maxTokens) {
    return {
      isValid: true,
      total: grand,
      overflow: 0,
      includedCount: contextChunks.length,
      includedTokens: sumCtx,
      droppedCount: 0,
      droppedTokens: 0,
      includedChunks: contextChunks,
      droppedChunks: [],
      breakdown: { system, user, history, context: sumCtx, replyMax },
      meta: { model, encoderUsed: encModel },
    };
  }

  const { included, dropped, includedTokens, droppedTokens, total } = trimToFit(
    { baseTokens: base, maxTokens, chunks: contextChunks, chunkTokenCounts: ctxCounts }
  );

  const overflow = Math.max(0, grand - maxTokens);

  return {
    isValid: false,
    total,
    overflow,
    includedCount: included.length,
    includedTokens,
    droppedCount: dropped.length,
    droppedTokens,
    includedChunks: included,
    droppedChunks: dropped,
    breakdown: { system, user, history, context: includedTokens, replyMax },
    meta: { model, encoderUsed: encModel },
  };
}
