# 🚀 STATUS – Chatbot-prosjektet

### Dato
- **09.09.2025**

### Versjon
- **v0.2.7 – Prompt Engine Online ⚙️🧠**

---

## Siste endringer
- ✅ `buildPrompt()` og `llmClient.ts` er i full bruk – alle chatkall bruker nå sanntidsbudsjett og fallback via `personaConfig`.
- ✅ NullFilter og Keepertrening har fullt støtte for intro, e-post, minne og visuell stil via `personaConfig`.
- ✅ Alle samtaler logges med `chat_sessions` og `chat_messages`, og bruker `persona.slug`.
- ✅ RAG og vanlig chat leverer konsistente svar – `systemPrompt` og `context` bygges fra samme kilde.
- ✅ RAG-støtte for pinned chunks (`pinnedDocId`) fra `personaConfig`.
- ✅ GitHub Actions CI er fjernet for enklere drift i Vercel.

---

## 1. Filstruktur (nivå 1–2 + viktige filer)

- **pages/**
  - index.js — Hovedside, lenke til admin og systemstatus
  - admin.js — Admin-grensesnitt for dokumentopplasting og tagging
  - **chat-nullfilter/** — NullFilter-chatbot (mental helse)
  - **chat-keepertrening/** — Keepertrening-chatbot (idrett)
  - **api/**
    - chat.js — Chat-endepunkt (OpenAI GPT-5)
    - rag/chat.js — Chat med RAG og dokumentstøtte
    - chat-stats.js — Statistikk for bruk og fallback
    - ... Øvrige RAG- og embed-endepunkter

- **utils/**
  - buildPrompt.ts — 🔄 Bygger systemprompt + messages
  - llmClient.ts — Kall mot OpenAI med fallback-støtte
  - tokenGuard.ts — Sjekker budsjett før kall
  - storage.ts — Lagring av samtaler
  - rag.ts — Henter kontekst fra RAG
  - chunker.js — Parser dokumenter til `rag_chunks`
  - docs.js — Dokumenthåndtering
  - dropdowns.ts — Verdier til admin-opplasting

- **config/**
  - personaConfig.js — Alt av oppførsel, intro, farger, modellvalg og tokenbudsjett

- **components/**
  - ChatEngine.js — Frontend-chatkomponent
  - PromptStudioPreview.js — Viser aktiv prompt/config
  - PromptStudioFull.js — Rediger `personaConfig` (kommende)

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
- created_at

**message_context_links**
- id (bigint, PK)
- message_id (uuid, FK)
- chunk_id (bigint, FK)
- similarity, created_at

---

## 3. Arkitektur og flyt
- Bruker velger bot (f.eks. NullFilter)
- Intro, farger og tone hentes fra `personaConfig`
- RAG brukes dynamisk ved behov, med pinned chunks som støtte
- Samtaler logges og kobles til dokumentkontekst
- systemPrompt bygges fra config + kontekst via `buildPrompt()`

---

## 4. Byggesteiner for personlig chatbot

🔧 Alt av tone, oppførsel og kunnskap kommer fra `personaConfig`. Det inkluderer:

- **Navn, avatar, farge** → frontend-stil
- **intro** → første melding
- **systemPrompt** → grunnstemme og regler
- **starters[]** → knapper med forslag
- **model, temperature, tokenBudget** → styrer AI-adferd
- **pinnedDocId** → tvinger inn chunks fra valgt dokument

✅ Når bruker starter samtale:
1. intro vises
2. starter valgt → sendes som melding
3. systemPrompt bygges via `buildPrompt`
4. samtalen logges fra første melding

---

## 5. Neste steg
- [ ] Observability: Logging av tid fra input → reply
- [ ] Tracking av `modelUsed`, `fallbackHit`, `trimmedContext` i `chat-stats.js`
- [ ] Visuell PromptStudio UI (for redigering av `personaConfig`)
- [ ] Sanntids RAG-dashboard med chunk-match visning
- [ ] QA + evaluering via Meta-LLM

---

## 6. Beslutninger & Valg
- AI = GPT-5 Mini i prod, GPT-4o-mini som fallback
- RAG = alltid aktiv, bruker `rag_chunks` (med `doc_id`, `source_type`, vektor)
- `personaConfig` = kilde til oppførsel, prompt og budsjetter
- `doc_number` = kun til visning, all logikk bruker UUID
- UUID = primærnøkkel i alle tabeller
- STATUS.md = løpende prosjektminne

---

## 7. Fremtidslogg
- Avatar med video og voice (NullFilter)
- Langtidshukommelse per bruker
- Integrasjon med Notion, Make, GPT Agents
- Ukentlig rapport via Meta-LLM

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

### v0.2.7 – Prompt Engine Online ⚙️🧠 (09.09.2025)
- `buildPrompt()` og `llmClient.ts` i full bruk i alle API-endepunkter
- GPT-5 Mini som default, GPT-4o-mini som fallback
- `rag/chat.js` støtter pinned chunks og bruker systemprompt riktig
- CI-workflow fjernet (GitHub Actions)
- Klar for observability og QA neste runde

### v0.2.6 – Persona Power Up 🧠✨ (09.09.2025)
- Full støtte for intro, oppførsel, startere og minne via `personaConfig`
- Logging av samtaler fungerer inkl. e-post og memory

### v0.2.5 – Token Tetris 🧱🧮 (08.09.2025)
- Produksjonsdeploy med RAG-verifisering

### v0.2.4 – Chunkmageddon 🧩⚡ (05.09.2025)
- Migrering til UUID, fullkobling mellom `rag_chunks` og `documents`

### v0.2.3 – Always AI 🤖✨ (05.09.2025)
- AI + RAG er alltid aktiv i alle samtaler
