# 🚀 STATUS – Chatbot-prosjektet

### Dato
- **09.09.2025**

### Versjon
- **v0.2.6 – Persona Power Up 🧠✨**

---

## Siste endringer
- ✅ NullFilter og Keepertrening har nå fullt støtte for e-post, minne og intro via `personaConfig`.
- ✅ Alle samtaler lagres med `chat_sessions` og `chat_messages`, og bruker `persona.slug`.
- ✅ Begge botsider støtter nå starterbobbler, avatar, farger og disclaimers direkte fra config.
- ✅ RAG-chat og vanlig chat leverer konsistente svar – `systemPrompt` og `context` kommer fra samme kilde.
- 🔨 Refaktorering av promptbygging og LLM-kall er påbegynt, integreres i neste versjon.

---

## 1. Filstruktur (nivå 1–2 + viktige filer)

- **pages/**
  - index.js — Hovedside, lenke til admin og oversikt over systemstatus
  - admin.js — Admin-grensesnitt for dokumentopplasting og tagging
  - **chat-nullfilter/** — NullFilter-chatbot (mental helse)
  - **chat-keepertrening/** — Keepertrening-chatbot (idrett)
  - **api/**
    - chat.js — Chat-endepunkt (OpenAI GPT-5)
    - rag/chat.js — Chat med RAG og dokumentstøtte
    - chat-stats.js — Statistikk for bruk og fallback
    - Øvrige RAG- og embed-endepunkter for søk og chunking

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
  - PromptStudioFull.js — Endre hele `personaConfig` fra UI (kommende)

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
- RAG brukes dynamisk ved behov, med kontekstlinking
- Samtaler og meldinger logges for analyse og QA
- systemPrompt bygges fra config + kontekst (buildPrompt)

---

## 4. Byggesteiner for personlig chatbot

🔧 Alt av tone, oppførsel og kunnskap kommer fra `personaConfig`. Det inkluderer:

- **Navn, avatar, farge** → styrer frontend
- **intro** → første melding fra bot
- **systemPrompt** → grunnstemme og regler
- **starters[]** → knapper som gir rask inngang
- **model, temperature, tokenBudget** → definerer samtaleopplevelse
- **replyMax, contextMax, pinnedChunks** → gir finjustert kontroll over responslengde og hukommelse

✅ Når bruker starter samtale:
1. intro vises
2. starter valgt → sendes som melding
3. systemPrompt bygges via `buildPrompt` (inkl. RAG hvis aktivt)
4. samtalen logges fra første melding

---

## 5. Neste steg
- [ ] Fullføre og ta i bruk `buildPrompt()` i både chat og RAG-endepunkt
- [ ] Erstatte hardkodet tokenbudsjett i `api/rag/chat.js`
- [ ] Logging av `modelUsed`, `fallbackHit`, `trimmedContext` i `chat-stats.js`
- [ ] Observability-dashboard på index.js
- [ ] Lage PromptStudio UI for å justere personlighet visuelt

---

## 6. Beslutninger & Valg
- AI = GPT-4o i dev, GPT-5 i prod
- `rag_chunks` er eneste sanne chunk-kilde
- Samtaler logges med sessions og meldinger
- `personaConfig` er kilde til sannhet for hver bot
- `doc_number` beholdes kun som referanse for mennesker
- UUID er brukt overalt som primærnøkkel
- STATUS.md oppdateres løpende og fungerer som hukommelse

---

## 7. Fremtidslogg
- Avatar med video + voice (NullFilter)
- Visuell prompt-builder
- RAG-dashboard med chunk-treff
- Meta-LLM for QA, evaluering og ukesrapport
- Premium: langtidshukommelse + historikk per bruker
- Integrasjon: Notion, Make, Supabase Edge Functions, GPT Agents

---

## 8. Økonomi & Break-even

**Faste kostnader**
- Vercel + Supabase: ~1 000 kr
- Domene + GitHub: ~500 kr
- GPT-5 Mini: ~2 000 kr

**Totalt:** ~3 500 kr/mnd

**Eksempel marginer**
- 300 brukere á 29 kr → +2 400 kr/mnd
- 3 000 brukere á 29 kr → +58 000 kr/mnd
- Break-even v/300 brukere (pris 29 kr)

---

## 1000. Changelog

### v0.2.6 – Persona Power Up 🧠✨ (09.09.2025)
- Lagt inn full støtte for intro + oppførsel via `personaConfig`
- Begge botsider (NullFilter og Keepertrening) leser startere, farge, avatar, disclaimer osv.
- Logging av samtaler fungerer, inkludert e-post og memory
- Klar for prompt-util og sanntidsbudsjett i neste versjon

### v0.2.5 – Token Tetris 🧱🧮 (08.09.2025)
- Full produksjonsdeploy OK
- Bekreftet RAG-endepunkter og dokumentflyt

### v0.2.4 – Chunkmageddon 🧩⚡ (05.09.2025)
- Migrert `rag_chunks.doc_id` fra int → uuid
- Backfill av tittel og kobling til dokumenter

### v0.2.3 – Always AI 🤖✨ (05.09.2025)
- Beslutning: AI alltid med i samtaler
- Forklart hvordan RAG og AI samspiller

...
