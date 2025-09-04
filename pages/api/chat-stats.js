// NY FIL: pages/api/chat-stats.js
// Returnerer: topp 10 doc_id (siste 7 dager), chunk/embedding totals, og simple mode counts.

let supabase = null;
async function getSupabase() {
  if (supabase) return supabase;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return supabase;
}

export default async function handler(_req, res) {
  try {
    const sb = await getSupabase();
    if (!sb) {
      return res.status(200).json({
        ok: true,
        info: "Supabase ikke konfigurert – returnerer tomme stats.",
        top_docs: [],
        chunks: { total: 0, with_embedding: 0, by_source: { ai: 0, master: 0 } },
        modes: { rag: 0, normal: 0 }
      });
    }

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // ── Topp 10 doc_id (sum hits) siste 7 dager ───────────────────────────────
    const { data: usage, error: usageErr } = await sb
      .from("rag_usage")
      .select("doc_id, source_type, hits")
      .gte("created_at", since);

    if (usageErr) throw new Error("Kunne ikke hente rag_usage: " + usageErr.message);

    const agg = {}; // { doc_id: { total, ai, master } }
    let ragCount = 0;
    for (const row of usage || []) {
      const id = row.doc_id;
      if (id == null) continue;
      if (!agg[id]) agg[id] = { total: 0, ai: 0, master: 0 };
      agg[id].total += row.hits || 0;
      if ((row.source_type || "").toLowerCase() === "ai") agg[id].ai += row.hits || 0;
      if ((row.source_type || "").toLowerCase() === "master") agg[id].master += row.hits || 0;
      ragCount++;
    }

    const top_docs = Object.entries(agg)
      .map(([doc_id, v]) => ({ doc_id: Number(doc_id), total: v.total, ai: v.ai, master: v.master }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ── Chunks/embeddings count ───────────────────────────────────────────────
    // Anta tabell: chunks(embedding vector?, content text, source_type text, doc_id int, ...)
    const { data: chunksTotal, error: ctErr } = await sb
      .from("chunks")
      .select("count", { count: "exact", head: true });
    if (ctErr) throw new Error("Kunne ikke telle chunks: " + ctErr.message);

    // "with_embedding": vi antar embedding IS NOT NULL
    const { data: withEmb, error: weErr } = await sb
      .from("chunks")
      .select("count", { count: "exact", head: true })
      .not("embedding", "is", null);
    if (weErr) throw new Error("Kunne ikke telle chunks med embedding: " + weErr.message);

    const { data: byAi, error: aiErr } = await sb
      .from("chunks").select("count", { count: "exact", head: true })
      .eq("source_type", "ai");
    if (aiErr) throw new Error("Kunne ikke telle ai-chunks: " + aiErr.message);

    const { data: byMaster, error: mErr } = await sb
      .from("chunks").select("count", { count: "exact", head: true })
      .eq("source_type", "master");
    if (mErr) throw new Error("Kunne ikke telle master-chunks: " + mErr.message);

    // ── Modes: vi bruker rag_usage som “rag”-proxy (normal teller vi ikke ennå) ─
    const modes = { rag: ragCount, normal: 0 };

    return res.status(200).json({
      ok: true,
      top_docs,
      chunks: {
        total: chunksTotal?.length === 0 ? 0 : chunksTotal,           // count-head returnerer tom array i supabase-js, men meta-count lever internt
        with_embedding: withEmb?.length === 0 ? 0 : withEmb,
        by_source: {
          ai: byAi?.length === 0 ? 0 : byAi,
          master: byMaster?.length === 0 ? 0 : byMaster
        }
      },
      modes
    });
  } catch (err) {
    console.error("[/api/chat-stats] error:", err);
    return res.status(200).json({
      ok: false,
      error: String(err?.message || err),
      top_docs: [],
      chunks: { total: 0, with_embedding: 0, by_source: { ai: 0, master: 0 } },
      modes: { rag: 0, normal: 0 }
    });
  }
}
