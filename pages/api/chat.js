// FERDIG VERSJON: pages/api/chat.js
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";

// --- Konfig ---
const BUCKET = "documents";
const PIN_AI_DOC_ID = "1";
const PIN_AI_FILENAME = "AI_mini_Morten.md";

const BASE_CONTEXT_BUDGET = 2000; // tokens
const DETAILED_CONTEXT_BUDGET = 3500;
const BASE_TOPK = { ai: 2, master: 5 };
const DETAILED_TOPK = { ai: 3, master: 7 };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("❌ Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// --- Utils ---
function isDetailedRequest(text = "") {
  const s = text.toLowerCase();
  return s.includes("utdyp") || s.includes("vis mer");
}

function approxTokens(str = "") {
  return Math.ceil((str.length || 0) / 4);
}

function summarizeChunk(text, maxChars = 600) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return cut.slice(0, lastDot > 0 ? lastDot + 1 : maxChars) + " …";
}

async function embedQuery(question) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: question })
  });
  if (!r.ok) throw new Error(`❌ Embedding feilet: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

async function matchChunks(supabase, queryEmbedding, { k, source_type = null } = {}) {
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding: queryEmbedding,
    match_count: k,
    filter_doc_id: null,
    filter_source_type: source_type
  });
  if (error) throw error;
  return data || [];
}

async function downloadPinnedMiniMorten(supabase) {
  const path = `ai/${PIN_AI_DOC_ID}/${PIN_AI_FILENAME}`;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`❌ Kunne ikke hente pinned Mini-Morten: ${error.message}`);
  const buff = Buffer.from(await data.arrayBuffer());
  return buff.toString("utf-8");
}

// --- API-handler ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { messages, question } = req.body || {};
    const userQuestion = question || (messages?.find(m => m.role === "user")?.content ?? "");

    if (!userQuestion) {
      return res.status(400).json({ error: "❌ Ingen bruker-spørsmål funnet" });
    }

    const supabase = serviceClient();

    // 1) Pinned: hele Mini-Morten
    const pinnedText = await downloadPinnedMiniMorten(supabase);

    // 2) RAG-henting
    const detailed = isDetailedRequest(userQuestion);
    const CONTEXT_BUDGET = detailed ? DETAILED_CONTEXT_BUDGET : BASE_CONTEXT_BUDGET;
    const TOPK = detailed ? DETAILED_TOPK : BASE_TOPK;

    const qEmbed = await embedQuery(userQuestion);
    const [aiHits, masterHits] = await Promise.all([
      matchChunks(supabase, qEmbed, { k: TOPK.ai, source_type: "ai" }),
      matchChunks(supabase, qEmbed, { k: TOPK.master, source_type: "master" })
    ]);

    // 3) Bygg RAG-kontekst
    const blocks = [];
    let used = 0;

    const items = [
      ...aiHits.map(r => ({ tag: "AI", row: r })),
      ...masterHits.map(r => ({ tag: "MASTER", row: r }))
    ];

    for (const it of items) {
      const header = `[[${it.tag} #${it.row.id} (${it.row.source_type}:${it.row.doc_id}:${it.row.chunk_index})]]\n`;
      const full = it.row.content || "";
      const body = detailed ? full : summarizeChunk(full);
      const text = header + body;
      const t = approxTokens(text);
      if (used + t > CONTEXT_BUDGET) break;
      used += t;
      blocks.push(text);
    }

    const ragContext = blocks.join("\n\n---\n\n");
    const depthNote = detailed
      ? ""
      : '\n\n[Noen deler er kort-summerte for plass. Skriv "utdyp" eller "vis mer" hvis jeg skal lage en mer detaljert beskrivelse.]';

    // 4) Bygg meldingsliste
    const chatMessages = [
      { role: "system", content: pinnedText },
      { role: "system", content: "KILDEBITER (kun som bakgrunn, ikke fasit):\n" + ragContext + depthNote },
      ...(messages || [{ role: "user", content: userQuestion }])
    ];

    // 5) Kjør modell
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: detailed ? 1200 : 600
    });

    const reply = chatResponse.choices?.[0]?.message?.content || "";

    res.status(200).json({
      ok: true,
      reply,
      mode: detailed ? "detailed" : "normal",
      used: {
        pinned_bytes: pinnedText.length,
        ai_hits: aiHits.length,
        master_hits: masterHits.length
      }
    });
  } catch (error) {
    console.error("❌ Chat-API-feil:", error);
    res.status(500).json({ error: "AI-svar feilet", detail: String(error?.message || error) });
  }
}
