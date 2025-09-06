// utils/perf.js — NY FIL
// Lettvekts presisjonsmåling med process.hrtime.bigint() + Server-Timing-støtte.
// Bruk: 
//   const perf = startPerf("chat");
//   perf.mark("db_connect_start");
//   ... gjør ting ...
//   perf.measure("db_connect_end", "db_connect_start"); // lagrer ms for steg
//   res.setHeader("Server-Timing", perf.serverTimingHeader()); // i API-rute
//
// Ekstra:
//   const snap = perf.snapshot({ tokens: { input: 123 } });
//   console.log("[PERF]", JSON.stringify(snap, null, 2));

const NS_PER_MS = 1_000_000n;
const toMs = (nsBig) => Number(nsBig) / 1_000_000;

export function startPerf(labelRoot = "perf") {
  const t0 = process.hrtime.bigint();
  const marks = new Map([["__t0", t0]]);
  const steps = [];

  const data = {
    labelRoot,
    meta: {
      pid: typeof process !== "undefined" ? process.pid : undefined,
      node: typeof process !== "undefined" ? process.version : undefined,
      startedAt: new Date().toISOString(),
    },
  };

  function mark(name) {
    const now = process.hrtime.bigint();
    marks.set(name, now);
    return now;
  }

  function measure(name, from = "__t0") {
    const a = marks.get(from) ?? t0;
    const b = marks.get(name) ?? process.hrtime.bigint();
    const durNs = b - a;
    const ms = toMs(durNs);
    steps.push({ name, ms });
    return ms;
  }

  function serverTimingHeader() {
    // RFC: "metric;dur=12.3"
    // NB: Browser devtools viser dette automatisk under "Network → Timing"
    return steps.map((s) => `${sanitizeMetric(s.name)};dur=${s.ms.toFixed(1)}`).join(", ");
  }

  function snapshot(extra = {}) {
    // Ta med minnebruk (Node), total tid, og evt. tillegg (tokens, sizes, etc.)
    const wallMs = measure("__end");
    const mem = safeMemory();
    return {
      ...data,
      steps: [...steps],
      totals: { wallMs },
      memory: mem,
      ...extra,
    };
  }

  function estimateTokens(strOrArray) {
    const text = Array.isArray(strOrArray) ? strOrArray.join(" ") : String(strOrArray || "");
    // Tommelfinger: ~4.2 tegn/token for norsk
    return Math.ceil(text.length / 4.2);
  }

  return {
    mark,
    measure,
    serverTimingHeader,
    snapshot,
    estimateTokens,
  };
}

// Hjelpere
function safeMemory() {
  try {
    const m = process.memoryUsage();
    return {
      rssMB: +(m.rss / 1024 / 1024).toFixed(1),
      heapUsedMB: +(m.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: +(m.heapTotal / 1024 / 1024).toFixed(1),
      externalMB: +(m.external / 1024 / 1024).toFixed(1),
    };
  } catch {
    return null;
  }
}

function sanitizeMetric(name = "") {
  // Tillatte tegn i Server-Timing metric token
  return String(name).replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 64) || "step";
}
