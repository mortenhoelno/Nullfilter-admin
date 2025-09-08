# 🚀 STATUS – Chatbot-prosjektet  

### Dato
- **08.09.2025**

### Versjon
- **v0.2.5 – Token Tetris 🧱🧮**

---

## Siste endringer
- ✅ Deploy til Vercel OK @ commit `4aa76da` (09.09 ca. 15:25), alle sider og API-ruter bygget.  
- ✅ RAG-endepunkter bekreftet i drift: `rag/{chat,search,ingest,status,pinned}`, `embed-{stats,backfill}`, `dev/{seed-chunks,backfill-embeddings}`, `chunk-sync`, `chat`, `chat-stats`.  
- ✅ Fullført migrering av `rag_chunks.doc_id` fra int → uuid med ekte FK til `documents.id`, inkl. backfill av `title`.  
- ✅ Admin viser menneskevennlig `doc_number` (1–50), mens uuid kun brukes i DB.  
- 🧪 Testløype for RAG verifisert: `seed-chunks → backfill-embeddings → search → chat`.  

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
    - chat-stats.js — Statistikk for chatter  
    - **_rag/_**
      - chat.js — Chat med RAG  
      - search.js — RAG-søk i rag_chunks  
      - ingest.js — Chunking & lagring i rag_chunks  
      - status.js — Status for dokumenter & chunks  
      - pinned.js — Alltid-på kontekst fra rag_chunks  
    - embed-stats.js — Oversikt embeddings  
    - embed-backfill.js — Fyll på embeddings  
    - **_dev/_**
      - seed-chunks.js — Opprett test-chunks  
      - backfill-embeddings.js — Backfill embeddings for test  
    - chunk-sync.js — Synkronisering av chunks  

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

**documents**
- id (uuid, PK)  
- doc_number (int, unikt, menneskevennlig nøkkel)  
- title, category, theme (metadata)  
- source, source_path, sha256, doc_hash (filreferanser)  
- version (default 'v1')  
- has_master, has_ai (flags)  
- created_at  

**rag_chunks (nå helt migrert)**
- id (bigint, PK)  
- doc_id (uuid, FK → documents.id) ✅  
- title (samme som dokumentets tittel)  
- content, token_count, chunk_index  
- source_type ('ai' | 'master')  
- embedding (vector(1536))  
- created_at  

**chat_sessions**
- id (uuid, PK)  
- bot_name (text)  
- user_id (uuid, nullable)  
- started_at, ended_at  

**chat_messages**
- id (uuid, PK)  
- session_id (uuid, FK → chat_sessions.id)  
- role ('user' | 'assistant' | 'system')  
- content (text)  
- tokens (int, nullable)  
- created_at  

**message_context_links**
- id (bigint, PK)  
- message_id (uuid, FK → chat_messages.id)  
- chunk_id (bigint, FK → rag_chunks.id)  
- similarity (float4)  
- created_at  

---

## 3. Arkitektur og flyt
- **Documents** = metadata om hele filer.  
- **Rag_chunks** = faktiske tekstbiter (AI og MASTER), knyttet til dokument via uuid.  
- **Chat_sessions** = samtaler, med info om hvilken bot og bruker.  
- **Chat_messages** = meldinger i en samtale.  
- **Message_context_links** = kobler meldinger til chunks (hvilken kunnskap som ble brukt).  

---

## 4. Utfordringer og feller
- Før migreringen var `rag_chunks.doc_id` int (doc_number), nå er alt rent med uuid.  
- Viktig å huske: `doc_number` eksisterer kun som menneskevennlig felt, aldri som kobling.  

---

## 5. Neste steg
- Implementere **Token Guard** i `api/chat` og `api/rag/chat` for å validere promptlengde og hindre overflow.  
- Bygge inn **toast-feilmeldinger** i stedet for alert/console i admin og chatsider.  
- Sette opp enkel **CI-workflow** for lint + build-test i GitHub Actions.  
- Utvide med **gjenbrukbare UI-komponenter** (toast, stat cards, hooks for RAG-status).  
- På sikt: legge til **role-basert withAuth** og **prompt-studio UI** for personaConfig.  

---

## 6. Beslutninger & Valg
- AI-modellvalg: Kjører GPT-4o nå, oppgraderer til GPT-5 i betalt versjon  
- Chunk-tabeller: Konsolidert til `rag_chunks` med `source_type` = 'ai' | 'master'  
- ChatEngine meldingshistorikk: Bruker 10 siste meldinger nå, plan for dynamisk historikk senere (styres av Token Guard)  
- RLS & sikkerhet: Åpent i utviklingsfasen, strammes inn i produksjon  
- Logging & analyse: Vi skal logge `chat_sessions` og `chat_messages` for kvalitet og innsikt  
- Filstruktur: Enkel, flat struktur med duplisering fremfor abstraksjon  
- PersonaConfig: Alt av chatbot-personlighet styres her  
- STATUS.md + changelog: Brukes som felles hukommelse  
- **Migrasjon til UUID (05.09.2025):**  
  - Hele systemet standardiseres på `documents.id` (uuid) som PK  
  - `doc_number` beholdes kun som menneskevennlig felt  
  - Migrering og backfill gjennomført  
- **AI alltid med (05.09.2025):**  
  - Hele AI-dokumentet for doc_number = 1 legges inn i alle samtaler.  
  - Begrunnelse: sikrer kjapp respons, tydelig tone og stabil stil.  
  - Konsekvens: prompten blir større, men gir jevnere brukeropplevelse.  
  - Neste vurdering: se på auto-henting av Master-chunks knyttet til samme doc_number når AI-chunks matcher.  
- **Databaseopprydding (05.09.2025):**  
  - Alle dummy-rader i `documents` er slettet.  
  - Kun ekte dokumenter beholdt: doc_number **1** og **50**.  
- **Migrasjon av rag_chunks (05.09.2025):**  
  - `doc_id` flyttet fra int (doc_number) → uuid (documents.id)  
  - Backfill av `title` fra dokumenter  
  - Fremtid: alle koblinger går via uuid, `doc_number` kun for menneskelig referanse  

---

## 7. Ideer på pause (Fremtidslogg)
- Video-avatar i chatboten (spesielt NullFilter)  
- Samtykkeskjema + e-post-oppfølging  
- Integrasjon med Kajabi / Make / Notion  
- Personlig oppfølging (se gamle samtaler, hente opp historikk)  
- Dashboard med RAG-treff, mest brukte dokumenter, antall samtaler  
- Fremtidig premium-versjon med GPT-5, minnefunksjon og personlig oppfølging  

---

## 8. Økonomi & Break-even 💰📊

### 8.1 Totale faste kostnader pr. måned
- **Hosting (Vercel + Supabase)**: ~1 000 kr  
- **GitHub + domene/småting**: ~500 kr  
- **AI-kostnad (GPT-5 Mini, moderat volum)**: ~2 000 kr  
- **Sum faste kostnader**: **~3 500 kr/mnd**

### 8.2 Betalingsgebyrer
- **Stripe Billing**: ca. 2,1 % + 2 kr per transaksjon  
- **Vipps**: 300 kr/mnd fastpris  

### 8.3 Margin-eksempler
- **300 kunder á 29 kr/mnd** → Resultat ~2 400 kr (ca. 34 % margin etter faste kost)  
- **3000 kunder á 29 kr/mnd** → Resultat ~58 600 kr (ca. 84 % margin)  

### 8.4 Break-even punkter
| Pris/mnd | Break-even kunder |
|----------|------------------|
| **9 kr**  | ~1000 |
| **12 kr** | ~1000 |
| **15 kr** | ~500 |
| **19 kr** | ~300 |
| **22 kr** | ~300 |
| **25 kr** | ~300 |
| **29 kr** | ~300 |
| **39 kr** | ~300 |
| **49 kr** | ~300 |
| **59 kr** | ~100 |

🔑 **Innsikt:**  
- Under 15 kr/mnd → trengs stort volum før break-even.  
- 19–29 kr/mnd → sweet spot (break-even ca. 300 kunder).  
- 59 kr/mnd → premium-modell, break-even allerede ved 100 kunder.  

---

## 1000. Changelog

### v0.2.5 – Token Tetris 🧱🧮 (08.09.2025)
- Bekreftet prod-deploy (`4aa76da`) og at alle RAG-endepunkter er operative  
- Oppdatert neste steg med Token Guard, Toasts og CI-workflow  
- Justert filstruktur til å inkludere nye API-ruter  
- Dokumentert testløype for RAG (seed → embeddings → search → chat)  

### v0.2.4 – Chunkmageddon 🧩⚡ (05.09.2025)
- Migrert `rag_chunks.doc_id` fra int → uuid med FK til documents.id  
- Backfill av `title` for alle chunks  
- Dokumentert hvordan dokumenter, chunks og logging-tabeller henger sammen  

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
