// utils/buildPrompt.ts
// Felles bygging av systemprompt + messages, med valgfri RAG-kontekst og historikk.
// Endrer ikke eksisterende adferd – gir deg bare en trygg util å kalle fra API-routes.

export type ChatRole = "system" | "user" | "assistant" | "tool" | "developer";

export type HistoryMessage =
  | { role: ChatRole; content: string }
  | string; // string tolkes som plain tekst (bruker/assistent blandet), men vi anbefaler eksplisitt role

export type PersonaConfig = {
  id?: string;
  name?: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  tokenBudget?: {
    pinnedMax?: number;
    ragMax?: number;
    replyMax?: number;
  };
};

export type BuildPromptInput = {
  persona: PersonaConfig;
  userPrompt: string;
  contextText?: string;
  contextChunks?: string[];
  history?: HistoryMessage[];
  overrideModel?: string;
  overrideTemperature?: number;
};

export type BuildPromptResult = {
  model: string;
  temperature: number;
  messages: Array<{ role: ChatRole; content: string }>;
  meta: {
    personaId?: string;
    hasContext: boolean;
    contextChars: number;
    historyCount: number;
  };
};

function composeSystemPrompt(baseSystem: string | undefined, contextText?: string): string {
  const parts: string[] = [];
  parts.push(baseSystem?.trim() || "Du er en varm, presis og hjelpsom assistent.");
  if (contextText && contextText.trim().length > 0) {
    parts.push("");
    parts.push("Relevant kontekst (bruk hvis relevant, ellers svar ærlig at du ikke vet):");
    parts.push("---");
    parts.push(contextText.trim());
    parts.push("---");
  }
  return parts.join("\n");
}

function normalizeHistory(history?: HistoryMessage[]): Array<{ role: ChatRole; content: string }> {
  if (!history || !Array.isArray(history)) return [];
  return history
    .map((h) =>
      typeof h === "string"
        ? ({ role: "assistant", content: h } as const)
        : ({ role: (h.role || "assistant") as ChatRole, content: h.content ?? "" } as const)
    )
    .filter((m) => m.content && m.content.trim().length > 0);
}

export function buildPrompt(input: BuildPromptInput): BuildPromptResult {
  const {
    persona,
    userPrompt,
    contextText,
    contextChunks,
    history,
    overrideModel,
    overrideTemperature,
  } = input;

  const composedContext =
    typeof contextText === "string"
      ? contextText
      : Array.isArray(contextChunks) && contextChunks.length > 0
      ? contextChunks.join("\n\n---\n\n")
      : "";

  const system = composeSystemPrompt(persona?.systemPrompt, composedContext);
  const hist = normalizeHistory(history);

  const model = (overrideModel || persona?.model || "gpt-4o") as string;
  const temperature =
    typeof overrideTemperature === "number"
      ? overrideTemperature
      : typeof persona?.temperature === "number"
      ? (persona!.temperature as number)
      : 0.2;

  const messages: Array<{ role: ChatRole; content: string }> = [
    { role: "system", content: system },
    ...hist,
    { role: "user", content: userPrompt || "" },
  ];

  return {
    model,
    temperature,
    messages,
    meta: {
      personaId: persona?.id ?? persona?.name,
      hasContext: composedContext.length > 0,
      contextChars: composedContext.length,
      historyCount: hist.length,
    },
  };
}
