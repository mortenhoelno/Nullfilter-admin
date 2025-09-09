// utils/llmClient.ts
// Tynn klient rundt OpenAI Chat Completions med valgfri fallback-modell og en enkel stream-hjelper.
// Bevarer eksisterende mønstre: du kan fortsatt bruke fetch+SSE i /api/chat hvis du vil.

import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool" | "developer"; content: string };

export type ChatCallInput = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: false;              // non-stream kallet – returnerer ferdig tekst
  fallbackModel?: string;      // f.eks. "gpt-4o-mini"
  enableFallback?: boolean;    // default true
  signal?: AbortSignal;
};

export type ChatCallResult = {
  ok: true;
  modelUsed: string;
  fallbackHit: boolean;
  reply: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  raw?: any; // rå OpenAI-respons for dyp debugging
} | {
  ok: false;
  error: string;
  modelTried?: string;
};

export async function chatCompletion({
  model,
  messages,
  temperature = 0.2,
  fallbackModel,
  enableFallback = true,
  signal,
}: ChatCallInput): Promise<ChatCallResult> {
  // Første forsøk
  try {
    const res = await openai.chat.completions.create(
      { model, messages, temperature, stream: false },
      { signal }
    );
    const reply = res.choices?.[0]?.message?.content ?? "";
    return {
      ok: true,
      modelUsed: model,
      fallbackHit: false,
      reply,
      usage: {
        promptTokens: res.usage?.prompt_tokens,
        completionTokens: res.usage?.completion_tokens,
        totalTokens: res.usage?.total_tokens,
      },
      raw: res,
    };
  } catch (err: any) {
    // Hvis fallback er skrudd på og vi har en alternativ modell, prøv én gang til
    if (enableFallback && fallbackModel && fallbackModel !== model) {
      try {
        const res2 = await openai.chat.completions.create(
          { model: fallbackModel, messages, temperature, stream: false },
          { signal }
        );
        const reply2 = res2.choices?.[0]?.message?.content ?? "";
        return {
          ok: true,
          modelUsed: fallbackModel,
          fallbackHit: true,
          reply: reply2,
          usage: {
            promptTokens: res2.usage?.prompt_tokens,
            completionTokens: res2.usage?.completion_tokens,
            totalTokens: res2.usage?.total_tokens,
          },
          raw: res2,
        };
      } catch (err2: any) {
        return {
          ok: false,
          error: String(err2?.message || err2),
          modelTried: `${model} -> ${fallbackModel}`,
        };
      }
    }
    return { ok: false, error: String(err?.message || err), modelTried: model };
  }
}

/**
 * Hjelper for eksisterende SSE/stream-mønster (slik /api/chat.js bruker i dag).
 * Returnerer en standard fetch() Promise<Response> så du kan lese .body.getReader() som før.
 *
 * OBS: Denne funksjonen streamer rå OpenAI-svar (uparsede deltaer).
 * Du beholder full kontroll i API-routen.
 */
export function streamFetchChat({
  model,
  messages,
  temperature = 0.2,
  signal,
}: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}) {
  const body = JSON.stringify({
    model,
    stream: true,
    messages,
    temperature,
  });

  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body,
    signal,
  });
}
