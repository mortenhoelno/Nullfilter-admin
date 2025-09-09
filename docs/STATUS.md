# 🚀 STATUS – Chatbot-prosjektet

### Dato
- **09.09.2025**

### Versjon
- **v0.2.8 – Smooth Operator 💅🚀**

---

## Siste endringer
- ✅ Responstid (`response_ms`) logges per melding i `chat_messages`.
- ✅ `utils/clientPerf.js` utvidet med måling → `ChatEngine.js` kobler perf til `onSend`.
- ✅ NullFilter og Keepertrening oppdatert slik at `saveMessage()` lagrer responstid.
- ✅ `personaConfig.js` utvidet med `intro` og `starters` → begge bots viser åpningslinje + bobler.
- ✅ NullFilter og Keepertrening testet: bobler, intro, minne og logging fungerer.
- ✅ Deploy fullført i Vercel uten feil (clientPerf.js fikset).
- ⚠️ Observability (modellvalg, fallback-rate osv.) fortsatt TODO.

---

## 1. Filstruktur (nivå 1–2 + viktige filer)

- **pages/**
  - index.js — Hovedside, lenke til admin
  - admin.js — Admin-grensesnitt (dokumenter)
  - **chat-nullfilter/** — NullFilter-chatbot (mental helse, intro + bobler)
  - **chat-keepertrening/** — Keepertrening-chatbot (idrett, intro + bobler)
  - **api/**
    - chat.js — Chat-endepunkt (OpenAI GPT-5 med fallback)
    - rag/chat.js — Chat med RAG og dokumentstøtte
    - chat-stats.js — Statistikk for responstid og modellbruk
    - ... øvrige RAG/embedding-endepunkter

- **utils/**
  - buildPrompt.ts — Bygger systemprompt + messages
  - llmClient.ts — Kall mot OpenAI med fallback
  - tokenGuard.ts — Sjekker tokenbudsjett
  - storage.js — Lagring av samtaler (inkl. response_ms)
  - rag.ts — Henter kontekst fra RAG
  - chunker.js — Parser dokumenter til `rag_chunks`
  - clientPerf.js — ⏱️ Måler svartid på frontend
  - docs.js — Dokumenthåndtering

- **config/**
  - personaConfig.js — Oppførsel, intro, bobler, modellvalg, tokenbudsjett

- **components/**
  - ChatEngine.js — Frontend-chatkomponent (nå med perf-integrasjon)

---

## 2. Databaseoversikt

**documents**
- id (uuid, PK)
- doc_number (int, menneskevennlig)
- title, category, theme
- source_path, sha256, doc_hash
- version ('v1'), has_master, has_ai
- created_at

**rag_chunks**
- id (bigint, PK)
- doc_id (uuid, FK → documents.id)
- title, content, token_count, chunk_index
- source_type ('ai' | 'master')
- embedding (vector)
- created_at

**chat_sessions**
- id (uuid, PK)
- bot_name, user_id
- started_at, ended_at

**chat_messages**
- id (uuid, PK)
- session_id (uuid, FK)
- role, content, tokens
- response_ms (int) ✅
- created_at

**message_context_links**
- id (bigint, PK)
- message_id (uuid, FK)
- chunk_id (bigint, FK)
- similarity, created_at

---

## 3. Arkitektur og flyt
- Bruker velger bot (NullFilter eller Keepertrening).
- Intro og bobler (starters) hentes fra `personaConfig`.
- RAG-kontekst lastes inn ved behov, pinned chunks alltid med.
- `systemPrompt` bygges fra config + kontekst via `buildPrompt()`.
- Samtaler logges i Supabase → inkl. responstid (`response_ms`).

---

## 4. Byggesteiner for personlig chatbot
- **Navn, avatar, farge** → frontend-stil
- **intro** → første melding
- **starters[]** → bobler
- **systemPrompt** → tone og regler
- **model, temperature, tokenBudget** → AI-adferd
- **pinnedDocId** → dokumentchunks som alltid inkluderes
- **response_ms** → målt svartid per melding

###🔎 Prompt-struktur med global pinned dokument

Når en bot (f.eks. NullFilter eller Keepertrening) bygger systemprompten, ser rekkefølgen slik ut:

[ SYSTEMPROMPT FRA PERSONA ]
"Du er en vennlig og kunnskapsrik chatbot ..."

--- GLOBAL PINNED DOC (Mini-Morten) ---
### Doc G1: Mini-Morten
<innhold fra pinned-dokumentet, alltid inkludert>

### Doc G2: Mini-Morten
<neste chunk fra samme dokument ...>

--- PERSONA PINNED DOC (valgfritt, hvis satt i personaConfig) ---
### Doc P1: KeeperTrening Manual
<chunks fra dokument persona er låst til>

--- RAG-DOKUMENTER (hentet dynamisk via embeddings) ---
### Doc R1: AI_mini_Morten
<relevant innhold hentet fra embeddingsøk>

### Doc R2: MASTER_Hjernen_vaner_endring
<mer innhold hentet dynamisk>

--- BRUKERMELDING ---
User: "Hvordan kan jeg roe meg ned når tankene spinner?"
---

## 5. Neste steg
- [ ] Utvide `chat-stats.js` til å vise `AVG(response_ms)` + `MAX(response_ms)`.
- [ ] Logge `modelUsed`, `fallbackHit`, `trimmedContext`.
- [ ] Visuell PromptStudio UI (redigere personaConfig).
- [ ] Flere dokumenter inn i RAG for test.
- [ ] QA & fallback-test ved nettverksfeil.

---

## 6. Beslutninger & Valg
- GPT-5 Mini i prod, GPT-4o-mini som fallback.
- RAG alltid aktiv, pinned chunks inkluderes.
- `personaConfig` = kilde for intro, bobler, systemPrompt og modellvalg.
- UUID som primærnøkkel i alle tabeller.
- `doc_number` kun til visning, ikke logikk.

---

## 7. Fremtidslogg
- Avatar med video/voice (NullFilter).
- Langtidshukommelse per bruker.
- Integrasjon med Notion, Make, GPT Agents.
- Ukentlig rapport via Meta-LLM.

---

## 8. Økonomi & Break-even
**Faste kostnader**
- Vercel + Supabase: ~1 000 kr
- Domene + GitHub: ~500 kr
- GPT-5 Mini: ~2 000 kr
- **Totalt:** ~3 500 kr/mnd

**Eksempel marginer**
- 300 brukere á 29 kr → +2 400 kr/mnd
- 3 000 brukere á 29 kr → +58 000 kr/mnd
- Break-even v/300 brukere

---

## 1000. Changelog

### v0.2.8 – Smooth Operator 💅🚀 (09.09.2025)
- Responstid (`response_ms`) logges i `chat_messages`.
- `clientPerf.js` + `ChatEngine.js` integrert for svartidsmåling.
- NullFilter + Keepertrening oppdatert med intro og bobler fra `personaConfig`.
- Begge bots testet og viser intro/bobler korrekt.
- Deploy verifisert i Vercel.

### v0.2.7 – Prompt Engine Online ⚙️🧠 (09.09.2025)
- `buildPrompt()` og `llmClient.ts` i bruk med token-budsjett.
- GPT-5 Mini med GPT-4o-mini fallback.
- RAG støtter pinned chunks fra `personaConfig`.
- CI-workflow fjernet.

### v0.2.6 – Persona Power Up 🧠✨ (09.09.2025)
- Støtte for intro, oppførsel, startere og minne via `personaConfig`.
- Logging av samtaler inkl. e-post.

### v0.2.5 – Token Tetris 🧱🧮 (08.09.2025)
- Produksjonsdeploy med RAG-verifisering.

### v0.2.4 – Chunkmageddon 🧩⚡ (05.09.2025)
- Migrering til UUID, kobling mellom `rag_chunks` og `documents`.

### v0.2.3 – Always AI 🤖✨ (05.09.2025)
- AI + RAG alltid aktiv i alle samtaler.
