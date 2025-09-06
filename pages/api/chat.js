// pages/api/chat.js — FERDIG VERSJON (maks detaljert logging)
import { startPerf } from "../../utils/perf";
import { getDbClient, vectorQuery, fetchDocsByIds } from "../../utils/rag";

// Konfig: bruk "nodejs" for maksimal kompatibilitet i API Routes.
// Bytt til "edge" hvis du kjører Edge-runtime og har DB/LLM-støtte der.
export const config = {
  runtime: "nodejs",
};

// Hjelp: enkel encoder for SSE
function sseEvent({ event, data }) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default async function handler(req, res) {
  const perf = startPerf("chat");
  const stepLog = []; // egen liste over steg (navn + ms) for å sende i meta/done

  // Hjelper for å måle og speile i stepLog
  const measure = (name, from) => {
    const ms = perf.measure(name, from);
    stepLog.push({ name, ms });
    return ms;
  };
  const mark = (name) => perf.mark(name);

  try {
    // ---- 0) Forberedelser & headere ----
    mark("req_in");

    // Viktig: annonsér at vi vil sende trailere for Server-Timing,
    // så vi kan levere endelige tall ETTER streaming.
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Trailer", "Server-Timing");

    // ---- 1) Parse input ----
    const url = new URL(req.url ?? "http://x");
    const qp = Object.fromEntries(url.searchParams);
    const userPrompt = (qp.q ?? "").toString();
    const topK = Number(qp.topK ?? 6);
    const minSim = Number(qp.minSim ?? 0.0);
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // ---- 2) DB connect ----
    mark("db_connect_start");
    const db = await getDbClient();
    measure("db_connect_end", "db_connect_start"); // DB connection time

    // ---- 3) Vector query ----
    mark("rag_query_start");
    const vecRes = await vectorQuery(db, userPrompt, { topK, minSim });
    measure("rag_query_end", "rag_query_start");

    // ---- 4) Fetch docs ----
    mark("docs_fetch_start");
    const docs = await fetchDocsByIds(db, vecRes.ids);
    measure("docs_fetch_end", "docs_fetch_start");

    // ---- 5) Context build / "parsing" ----
    mark("ctx_build_start");
    const contextText = docs
      .map((d, i) => `### Doc ${i + 1}: ${d.title}\n${d.content}`)
      .join("\n\n");
    const inputTokens = perf.estimateTokens([contextText, userPrompt]);
    measure("ctx_build_end", "ctx_build_start");

    // ---- 6) Forbered LLM-body ----
    const systemPrompt = "Du er Null Filter – svar kort, korrekt og vennlig. Bruk bare relevant kontekst.";
    const llmBody = {
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Kontekst:\n${contextText}\n\nSpørsmål:\n${userPrompt}\n\nSvar:` },
      ],
      temperature: 0.2,
    };

    // ---- 7) Send warmup/meta til frontend før vi starter LLM-kall ----
    // Inneholder alt vi har målt så langt + RAG-parametre, input tokens osv.
    res.write(
      sseEvent({
        event: "meta",
        data: {
          timingHint: "init",
          steps: [...stepLog],
          rag: { topK, returned: docs.length, minSim },
          tokens: { input: inputTokens },
          model,
        },
      })
    );

    // ---- 8) LLM HTTP request ----
    mark("llm_req_start");
    const llmReqStartWall = Date.now();

    mark("llm_http_send");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(llmBody),
    });
    measure("llm_http_send", "llm_req_start"); // "request build + send" tid

    if (!resp.ok || !resp.body) {
      throw new Error(`LLM HTTP ${resp.status}`);
    }

    // ---- 9) Stream parsing & forwarding ----
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    let sawFirstToken = false;
    let clientFirstChunkSent = false;
    let outputChars = 0;
    let outputChunks = 0;
    let outputBytes = 0;

    // Vi parser OpenAI SSE-linjer og emitter egne, konsise delta-events til klienten.
    // Hver "data: {...}" kan inneholde deltaer; vi trekker ut text-delta hvis mulig.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value, { stream: true });
      outputBytes += value.byteLength;

      // OpenAI SSE kan komme i flere "data: ..." linjer per chunk.
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          // ferdig
          continue;
        }

        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? "";
          if (!sawFirstToken && (delta?.length || json?.choices?.[0]?.delta?.role)) {
            sawFirstToken = true;
            mark("llm_first_token");
            measure("llm_first_token", "llm_http_send"); // TTFB/TTFT fra send → første token
          }

          if (delta) {
            outputChars += delta.length;
            outputChunks += 1;

            if (!clientFirstChunkSent) {
              // måle tiden til første delta sendt til frontend
              clientFirstChunkSent = true;
              mark("client_first_chunk");
              measure("client_first_chunk", "llm_req_start");
            }

            // Send videre et lettvekts SSE-event som er enkelt å rendre
            res.write(
              sseEvent({
                event: "delta",
                data: { t: Date.now(), text: delta },
              })
            );
          }
        } catch {
          // Ignorer linjer som ikke er JSON (kan være tomme heartbeats)
        }
      }
    }

    // ---- 10) LLM stream slutt ----
    mark("llm_stream_ended");
    measure("llm_stream_ended", "llm_req_start");

    // ---- 11) Ferdig – lag snapshot med alt av tall ----
    // Estimer output-tokens fra outputChars
    const outputTokens = perf.estimateTokens("x".repeat(Math.max(0, outputChars)));

    // Marker total sluttid før snapshot
    mark("__end");
    const snap = perf.snapshot({
      tokens: { input: inputTokens, output: outputTokens },
      llm: {
        model,
        requestStartedAt: new Date(llmReqStartWall).toISOString(),
        output: {
          chars: outputChars,
          chunks: outputChunks,
          bytes: outputBytes,
        },
      },
      rag: {
        topK,
        returned: docs.length,
        minSim,
      },
      steps: [...stepLog],
    });

    // ---- 12) Send "done" event til frontend med hele snapshot ----
    res.write(sseEvent({ event: "done", data: snap }));

    // ---- 13) Legg til HTTP Trailer for Server-Timing (fungerer med chunked transfer) ----
    // Dette lar oss levere endelige tall selv om vi har streamet body allerede.
    if (typeof res.addTrailers === "function") {
      res.addTrailers({ "Server-Timing": perf.serverTimingHeader() });
    }

    // ---- 14) Avslutt ----
    res.end();

    // Serverlogg (strukturert)
    console.log("[CHAT PERF]", JSON.stringify(snap, null, 2));
  } catch (err) {
    // Sikker avslutning ved feil
    try {
      const message = String(err?.message || err);
      const code = /HTTP\s+(\d+)/.exec(message)?.[1] ?? "500";
      // Send SSE-feilevent hvis mulig
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
      // fall back til JSON feil hvis SSE ikke funker
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      } else {
        res.end();
      }
    }
    console.error("chat error", err);
  }
}
