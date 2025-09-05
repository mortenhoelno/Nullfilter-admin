# 🚀 STATUS – Chatbot-prosjektet  

### Dato
- **05.09.2025**

### Versjon
- **v0.2.3 – Always AI 🤖✨**

---

## Siste endringer
- Ny seksjon: **Hvordan AI + RAG fungerer hos oss**  
- Ny beslutning: **AI alltid med i alle samtaler** (allerede i praksis implementert)  
- Oppdatert dokumentasjon: logging og bruken av Master som utdyping  
- UUID-migrasjon ferdigstilt i forrige versjon (v0.2.2)  
- Database ryddet: kun dokumentene **#1 (AI_mini_Morten)** og **#50 (MASTER_Hjernen_vaner_endring)** beholdt  

---

## 1. Filstruktur (nivå 1–2 + viktige filer)

- **pages/**
  - index.js — Hovedside, lenke til admin  
  - admin.js — Admin-grensesnitt for dokumentopplasting  
  - **_chat-nullfilter/_**
    - index.js — NullFilter-chatbot (mental helse)  
  - **_chat-keepertrening/_**
    - index.js — Keepertrening-chatbot (idrett)  
  - **_api/_**
    - chat.js — Chat-endepunkt (OpenAI GPT-5)  
    - **_rag/_**
      - search.js — RAG-søk i rag_chunks  
      - ingest.js — Chunking & lagring i rag_chunks  
      - status.js — Status for dokumenter & chunks  
      - pinned.js — (Oppdatert → bruker rag_chunks)  
      - ...  

- **utils/**
  - docs.js — Dokumenthåndtering (upsert, sync, list)  
  - upload.js — Opplasting av dokumenter  
  - chunker.js — Chunking av tekst/PDF → rag_chunks  
  - supabase.js — Supabase-klient  
  - dropdowns.ts — Henter og lagrer verdier for dropdowns  

- **config/**
  - personaConfig.js — Persona-config (avatar, farger, intro per bot)  

- **public/** — Statisk innhold (bilder, avatarer, osv.)  
- package.json — Prosjektets pakkedefinisjon  

---

## 2. Databaseoversikt
*(ingen endring her, beholdt fra forrige versjon)*  

---

## 3. Arkitektur og flyt
*(ingen endring her, beholdt fra forrige versjon)*  

---

## 4. Utfordringer og feller
*(ingen endring her, beholdt fra forrige versjon)*  

---

## 5. Neste steg
*(ingen endring her, beholdt fra forrige versjon)*  

---

## 6. Beslutninger & Valg
- AI-modellvalg: Kjører GPT-4o nå, oppgraderer til GPT-5 i betalt versjon  
- Chunk-tabeller: Konsolidert til `rag_chunks` med `source_type` = 'ai' | 'master'  
- ChatEngine meldingshistorikk: Bruker 10 siste meldinger nå, plan for dynamisk historikk senere  
- RLS & sikkerhet: Åpent i utviklingsfasen, strammes inn i produksjon  
- Logging & analyse: Vi skal logge `chat_sessions` og `chat_messages` for kvalitet og innsikt  
- Filstruktur: Enkel, flat struktur med duplisering fremfor abstraksjon  
- PersonaConfig: Alt av chatbot-personlighet styres her  
- STATUS.md + changelog: Brukes som felles hukommelse  
- **Migrasjon til UUID (05.09.2025):**  
  - Hele systemet standardiseres på `documents.id` (uuid) som PK  
  - `doc_number` beholdes kun som menneskevennlig felt  
  - Migrering og backfill gjennomført  
  - Alle nye tabeller bruker `doc_uuid`  
- **AI alltid med (05.09.2025):**  
  - Hele AI-dokumentet for doc_number = 1 legges inn i alle samtaler.  
  - Begrunnelse: sikrer kjapp respons, tydelig tone og stabil stil.  
  - Konsekvens: prompten blir større, men gir jevnere brukeropplevelse.  
  - Neste vurdering: se på auto-henting av Master-chunks knyttet til samme doc_number når AI-chunks matcher.  
- **Databaseopprydding (05.09.2025):**  
  - Alle dummy-rader i `documents` er slettet.  
  - Kun ekte dokumenter beholdt: doc_number **1** og **50**.  

---

## 7. Ideer på pause (Fremtidslogg)
*(ingen endring her, beholdt fra forrige versjon)*  

---

## 1000. Changelog

### v0.2.3 – Always AI 🤖✨ (05.09.2025)
- Ny seksjon: forklaring på hvordan AI + RAG fungerer steg-for-steg  
- Beslutning: AI alltid med i alle samtaler (allerede i praksis implementert)  
- Oppdatert dokumentasjon: logging og bruken av Master som utdyping  
- UUID-migrasjon ferdigstilt i v0.2.2  
- Database ryddet: kun dokumentene **1** og **50** beholdt  

### v0.2.2 – UUID invasion 👾🔑 (05.09.2025)
- Beslutning: migrere alle referanser til `documents.id` (uuid)  
- Oppdatert `rag_chunks`, `rag_usage`, planlagt `message_context_links`  
- Dokumentert at `doc_number` kun er menneskevennlig referanse  
- Migrering og backfill gjennomført  

### v0.2.1 – Apehjernen tar notater 📓🐒 (05.09.2025)
- Lagt til seksjonen **Beslutninger & Valg** (modell, chunks, logging, sikkerhet, struktur)  
- Lagt til seksjonen **Ideer på pause (Fremtidslogg)**  
- Dokumentet fungerer nå også som felles hukommelse  

### v0.2.0 – RagChunks strikes back ⚡️📚 (05.09.2025)
- Konsolidert til `rag_chunks` som eneste sanne kilde for chunks  
- Oppdatert `backfill-embeddings.js` og `pinned.js` → peker nå på `rag_chunks`  
- Lagt inn full kolonneliste for alle chunk-tabeller  
- `ai_chunks` og `master_chunks` merket DEPRECATED (beholdt for trygghet)  
- Dokumentert utfordringer og neste steg  
- Startet versjonslogg med humoristiske kallenavn 🎉  

### v0.1.0 – Apehjernen våkner 🐒💡 (04.09.2025)
- Første helhetlige statusrapport laget  
- Oversikt over tabeller, policies, triggere, indekser og extensions  
- Oppdaget manglende chat-loggingstabeller (`chat_messages`, `chat_sessions`)  
- Første feilsøking på `chat_messages` (tabell ikke eksisterte)  
- Noterte for brede policies på `documents`  
- Satt plan for logging, RAG og status-spørringer  
