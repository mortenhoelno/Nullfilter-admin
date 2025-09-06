// utils/clientPerf.js — NY FIL
// Frontend timing og SSE-klient for chat.
// Måler: sendClick → requestStart → firstDelta → firstPaint → done
// Viser tabell i console + kan trigge callback for videre rapportering.

export function createClientPerf(label = "chat") {
  const t0 = performance.now();
  const marks = new Map([["t0", t0]]);
  const steps = [];
  let painted = false;
  let finished = false;

  function mark(name) {
    marks.set(name, performance.now());
  }
  function measure(name, from = "t0") {
    const a = marks.get(from) ?? t0;
    const b = marks.get(name) ?? performance.now();
    const ms = +(b - a).toFixed(1);
    steps.push({ name, ms });
    return ms;
  }

  const perf = {
    label,
    steps,
    meta: {},

    onSendClick() {
      mark("sendClick");
      measure("sendClick");
    },

    onRequestStart() {
      mark("requestStart");
      measure("requestStart");
    },

    onFirstDelta() {
      if (!marks.has("firstDelta")) {
        mark("firstDelta");
        measure("firstDelta", "requestStart"); // nettverks+server til første byte
      }
    },

    onFirstPaint() {
      if (!painted) {
        painted = true;
        mark("firstPaint");
        // tid fra første delta → første synlige tegn på skjerm
        measure("firstPaint", "firstDelta");
      }
    },

    onDone(extra = {}) {
      if (finished) return;
      finished = true;
      mark("done");
      measure("done", "t0");
      if (extra && typeof extra === "object") {
        perf.meta = { ...perf.meta, ...extra };
      }
      // Pretty log
      try {
        // lag en tabell som også viser totals
        const table = steps.reduce((acc, s) => {
          acc[s.name] = s.ms + " ms";
          return acc;
        }, {});
        console.group(`[${label}] Frontend timing`);
        console.table(table);
        if (Object.keys(perf.meta || {}).length) {
          console.log("meta:", perf.meta);
        }
        console.groupEnd();
      } catch {}
      return { steps, meta: perf.meta };
    },
  };

  return perf;
}

/**
 * createSSEClient
 * En lettvekts SSE-klient som håndterer endepunktet /api/chat (som sender event: meta|delta|done).
 * - Kaller perf.onFirstDelta() ved første delta
 * - Eksponerer onToken(text) for å bygge visning inkrementelt
 * - Returnerer en abort-funksjon
 */
export function createSSEClient(url, { perf, onMeta, onToken, onDone, onError } = {}) {
  const ctrl = new AbortController();

  async function run() {
    try {
      perf?.onRequestStart();

      const resp = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawFirstDelta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE-rammer kan komme chunket – parse komplett pakke(r)
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          // parse event-type + data
          const lines = chunk.split(/\r?\n/);
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              data += line.slice(5).trim();
            }
          }

          if (!data) continue;

          if (event === "meta") {
            try {
              const meta = JSON.parse(data);
              perf && (perf.meta = { ...perf.meta, serverMeta: meta });
              onMeta?.(meta);
            } catch {}
          } else if (event === "delta") {
            try {
              const { text } = JSON.parse(data);
              if (!sawFirstDelta && text) {
                sawFirstDelta = true;
                perf?.onFirstDelta();
              }
              if (text) onToken?.(text);
            } catch {}
          } else if (event === "done") {
            try {
              const donePayload = JSON.parse(data);
              perf?.onDone({ serverDone: donePayload });
              onDone?.(donePayload);
            } catch (e) {
              perf?.onDone();
              onDone?.();
            }
            return; // ferdig
          } else if (event === "error") {
            try {
              const err = JSON.parse(data);
              onError?.(err);
            } catch {
              onError?.({ message: data });
            }
            // Avslutt ved error
            return;
          }
        }
      }

      // Hvis stream ender uten "done", fullfør likevel
      perf?.onDone();
      onDone?.();
    } catch (err) {
      onError?.(err);
      try {
        perf?.onDone({ error: String(err?.message || err) });
      } catch {}
    }
  }

  run();

  // Returner en abort-funksjon så vi kan avbryte ved ny forespørsel
  return () => {
    try {
      ctrl.abort();
    } catch {}
  };
}
