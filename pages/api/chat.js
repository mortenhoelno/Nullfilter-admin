// pages/api/chat.js
import { startPerf } from "../../utils/perf";
import { getDbClient, vectorQuery, fetchDocsByIds } from "../../utils/rag";
import { tokenGuard } from "../../utils/tokenGuard";
import personaConfig from "../../config/personaConfig";

// ⬇️ Nye utiler (bevarer eksisterende adferd, bare ryddigere)
import { buildPrompt } from "../../utils/buildPrompt";
import { streamFetchChat } from "../../utils/llmClient";

export const config = { runtime: "nodejs" };

function sseEvent({ event, data }) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getBaseUrl(req) {
  try {
    const proto = (req.headers["x-forwarded-proto"] || "").toString().split(",")[0] || "http";
    const host = req.headers.host || "localhost:3000";
    return `${proto}://${host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function lastUserFromMessages(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

export default async function handler(req, res) {
  const perf = startPerf("chat");
  const stepLog = [];
  const measure = (name, from) => {
    const ms = perf.measure(name, from);
    stepLog.push({ name, ms });
    return ms;
  };
  const mark = (name) => perf.mark(name);

  try {
    mark("req_in");

    // SSE-headere
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Trailer", "Server-Timing");

    // Robust URL-parsing m/ base (fikser "Invalid URL" ved POST)
    const absBase = getBaseUrl(req);
    const url = new URL(req.url || "/api/chat", absBase);

    // Støtt både GET (?q=) og POST ({ q } | { messages })
    const qp = Object.fromEntries(url.searchParams);
    const body = (req.method === "POST" && typeof req.body === "object") ? req.body : {};

    const userPrompt =
      (typeof body?.q === "string" && body.q) ||
      lastUserFromMessages(body?.messages) ||
      (qp.q ?? "").toString();

    const topK = Number((body?.topK ?? qp.topK) ?? 6);
    const minSim = Number((body?.minSim ?? qp.minSim) ?? 0.0);
    const botId = (body?.botId ?? qp.botId) || "nullfilter";

    // Persona (modell, systemprompt, budsjett)
    const persona = personaConfig[botId];
    if (!persona) throw new Error(`Ukjent botId: ${botId}`);
    const { tokenBudget } = persona;

    // DB → vector query → hent docs
    mark("db_connect_start");
    const db = await getDbClient();
    measure("db_connect_end", "db_connect_start");

    mark("rag_query_start");
    const vecRes = await vectorQuery(db, userPrompt, { topK, minSim });
    measure("rag_query_end", "rag_query_start");

    mark("docs_fetch_start");
    const docs = await fetchDocsByIds(db, vecRes.ids);
    measure("docs_fetch_end", "docs_fetch_start");

    // Bygg kontekst (prioritert rekkefølge)
    mark("ctx_build_start");
    const contextChunks = docs.map((d, i) => `### Doc ${i + 1}: ${d.title}\n${d.content}`);
    measure("ctx_build_end", "ctx_build_start");

    // Budsjett til tokenGuard (fra personaConfig)
    const maxTokens =
      (tokenBudget?.pinnedMax ?? 0) +
      (tokenBudget?.ragMax ?? 0) +
      (tokenBudget?.replyMax ?? 0);

    // Bygg system+messages via util — KONTEKST appender under systemprompt
    const promptPack = buildPrompt({
      persona,
      userPrompt,
      contextChunks,
      history: [],            // vi har ikke historikk i denne route-varianten
    });

    // TokenGuard bruker eksakt system-tekst og replyMax fra persona
    const guard = tokenGuard({
      systemPrompt: promptPack.messages[0]?.content || "",
      userPrompt,
      contextChunks,
      historyMessages: [],    // ingen historikk her
      maxTokens,
      replyMax: persona?.tokenBudget?.replyMax ?? 1200,
      model: promptPack.model,
    });

    if (!guard.isValid) {
      res.write(
        sseEvent({
          event: "error",
          data: {
            message: "Prompten ble for lang. Prøv å skrive spørsmålet litt kortere.",
            droppedChunks: guard.droppedChunks,
          },
        })
      );
      res.end();
      return;
    }

    // Stream til OpenAI – samme mønster som før (SSE ut til klient)
    // Vi bruker llmClient.streamFetchChat for å bygge korrekt request.
    res.write(
      sseEvent({
        event: "meta",
        data: {
          timingHint: "init",
          steps: [...stepLog],
          rag: { topK, returned: docs.length, minSim },
          tokens: { input: guard.total },
          model: promptPack.model,
        },
      })
    );

    mark("llm_req_start");
    const llmReqStartWall = Date.now();

    const resp = await streamFetchChat({
      model: promptPack.model,
      messages: promptPack.messages,
      temperature: promptPack.temperature,
    });

    mark("llm_http_send");

    if (!resp.ok || !resp.body) {
      throw new Error(`LLM HTTP ${resp.status}`);
    }

    // Les stream → videresend SSE
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    let sawFirstToken = false;
    let clientFirstChunkSent = false;
    let outputChars = 0;
    let outputChunks = 0;
    let outputBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value, { stream: true });
      outputBytes += value.byteLength;

      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? "";
          if (!sawFirstToken && (delta?.length || json?.choices?.[0]?.delta?.role)) {
            sawFirstToken = true;
            mark("llm_first_token");
            measure("llm_first_token", "llm_http_send");
          }

          if (delta) {
            outputChars += delta.length;
            outputChunks += 1;

            if (!clientFirstChunkSent) {
              clientFirstChunkSent = true;
              mark("client_first_chunk");
              measure("client_first_chunk", "llm_req_start");
            }

            res.write(sseEvent({ event: "delta", data: { t: Date.now(), text: delta } }));
          }
        } catch {
          // ignorér parsefeil i stream
        }
      }
    }

    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    const outputTokens = perf.estimateTokens("x".repeat(Math.max(0, outputChars)));
    mark("__end");

    const snap = perf.snapshot({
      tokens: { input: guard.total, output: outputTokens },
      llm: {
        model: promptPack.model,
        requestStartedAt: new Date(llmReqStartWall).toISOString(),
        output: {
          chars: outputChars,
          chunks: outputChunks,
          bytes: outputBytes,
        },
      },
      rag: { topK, returned: docs.length, minSim },
      steps: [...stepLog],
    });

    res.write(sseEvent({ event: "done", data: snap }));

    if (typeof res.addTrailers === "function") {
      res.addTrailers({ "Server-Timing": perf.serverTimingHeader() });
    }

    res.end();
    console.log("[CHAT PERF]", JSON.stringify(snap, null, 2));
  } catch (err) {
    try {
      const message = String(err?.message || err);
      const code = /HTTP\s+(\d+)/.exec(message)?.[1] ?? "500";
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
      }
      res.write(sseEvent({ event: "error", data: { message, code } }));
      if (typeof res.addTrailers === "function") {
        res.addTrailers({ "Server-Timing": perf.serverTimingHeader() });
      }
      res.end();
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      } else {
        res.end();
      }
    }
    console.error("chat error", err);
  }
}
