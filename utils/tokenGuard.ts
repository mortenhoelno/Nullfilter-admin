// utils/tokenGuard.ts
// Fleksibel token-guard med trimming og modell-fallbacks.
// ⚠️ Bruk denne i API Routes med runtime "nodejs" (tiktoken støttes ikke i Edge).
import { encoding_for_model } from "tiktoken";
import type { TiktokenModel } from "tiktoken";
import { resolveEncoderModel } from "./modelConfig";

export type TokenGuardInput = {
  systemPrompt: string;
  userPrompt: string;
  contextChunks?: string[];    // prioritert rekkefølge (viktigst først)
  historyMessages?: string[];  // frivillig chat-historikk
  maxTokens: number;           // total context (prompt + svar) for modellen
  replyMax: number;            // ønsket max tokens i LLM-svar
  model?: string;              // f.eks. gpt-4o-mini, gpt-5-mini
};

export type TokenGuardResult = {
  isValid: boolean;
  total: number;               // total etter ev. trimming
  overflow: number;            // hvor mye vi var over før trimming
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
    context: number;           // faktisk brukt kontekst etter trimming
    replyMax: number;
  };
  meta: {
    model: string;             // originalt modellnavn
    encoderModel: TiktokenModel; // hvilken encoder tiktoken bruker
  };
};

// Intern encoder-cache (unngår å instansiere encoder hver gang)
const encoderCache = new Map<TiktokenModel, ReturnType<typeof encoding_for_model>>();

function getEncoder(model: string) {
  const encModel = resolveEncoderModel(model);
  if (encoderCache.has(encModel)) return { enc: encoderCache.get(encModel)!, encModel };
  const enc = encoding_for_model(encModel);
  encoderCache.set(encModel, enc);
  return { enc, encModel };
}

export function estimateTokens(text: string, enc: ReturnType<typeof encoding_for_model>): number {
  if (!text) return 0;
  return enc.encode(text).length;
}

/** Trim kontekst til den passer budsjettet. Antar chunks er sortert på prioritet (viktigst først). */
function trimToFit(params: {
  baseTokens: number;            // system + user + history + replyMax
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

/** Hovedfunksjon: beregn tokens, trim kontekst ved behov og returnér detaljert budsjettinfo. */
export function tokenGuard(input: TokenGuardInput): TokenGuardResult {
  const {
    systemPrompt,
    userPrompt,
    contextChunks = [],
    historyMessages = [],
    maxTokens,
    replyMax,
    model = "gpt-4o-mini",
  } = input;

  const { enc, encModel } = getEncoder(model);

  const systemTokens  = estimateTokens(systemPrompt, enc);
  const userTokens    = estimateTokens(userPrompt, enc);
  const historyTokens = historyMessages.reduce((sum, m) => sum + estimateTokens(m, enc), 0);
  const chunkTokenCounts = contextChunks.map((c) => estimateTokens(c, enc));

  const baseTokens = systemTokens + userTokens + historyTokens + replyMax;
  const sumContext = chunkTokenCounts.reduce((a, b) => a + b, 0);
  const grandTotal = baseTokens + sumContext;

  if (grandTotal <= maxTokens) {
    return {
      isValid: true,
      total: grandTotal,
      overflow: 0,
      includedCount: contextChunks.length,
      includedTokens: sumContext,
      droppedCount: 0,
      droppedTokens: 0,
      includedChunks: contextChunks,
      droppedChunks: [],
      breakdown: {
        system: systemTokens,
        user: userTokens,
        history: historyTokens,
        context: sumContext,
        replyMax,
      },
      meta: { model, encoderModel: encModel },
    };
  }

  const { included, dropped, includedTokens, droppedTokens, total } = trimToFit({
    baseTokens,
    maxTokens,
    chunks: contextChunks,
    chunkTokenCounts,
  });

  const overflow = Math.max(0, grandTotal - maxTokens);

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
    breakdown: {
      system: systemTokens,
      user: userTokens,
      history: historyTokens,
      context: includedTokens,
      replyMax,
    },
    meta: { model, encoderModel: encModel },
  };
}
