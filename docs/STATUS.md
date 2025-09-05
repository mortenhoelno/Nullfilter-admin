# 🚀 STATUS – Chatbot-prosjektet  

### Dato
- **05.09.2025**

### Versjon
- **v0.2.1 – Apehjernen tar notater 📓🐒**

---

## Siste endringer
- Ny seksjon: **Beslutninger & Valg** – samlet oversikt over faktiske valg vi har tatt  
- Ny seksjon: **Ideer på pause (Fremtidslogg)** – egen logg for idéer som er parkert  
- STATUS.md fungerer nå både som statusrapport og felles hukommelse  

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

- **config/**
  - personaConfig.js — Persona-config (avatar, farger, intro per bot)  

- **public/** — Statisk innhold (bilder, avatarer, osv.)  
- package.json — Prosjektets pakkedefinisjon  

---

## 2. Databaseoversikt

### 2.1 Systeminfo
- **Postgres-versjon**: 17.4 (64-bit, aarch64)  
- **Search path**: `$user, public, extensions`  

### 2.2 Tabeller & kolonner

#### documents
- id (uuid, PK, default gen_random_uuid)  
- title (text, metadata)  
- category (text, metadata)  
- theme (text, metadata)  
- source (text, filreferanse)  
- source_path (text, filreferanse)  
- sha256 (text, hash av fil)  
- doc_hash (text, hash av innhold)  
- doc_number (int, unik indeks)  
- version (text, default 'v1')  
- has_master (boolean, default false)  
- has_ai (boolean, default false)  
- created_at (timestamp, default now)  

#### rag_chunks (single source of truth)
- id (bigint, PK)  
- doc_id (int, FK → documents.id)  
- title (text, metadata)  
- content (text, chunked innhold)  
- chunk_index (int, posisjon i dokument)  
- token_count (int)  
- token_estimate (int)  
- embedding (vector(1536))  
- source_type (text: 'ai' | 'master')  
- source_path (text, filreferanse)  
- sha256 (text, hash av chunk)  
- created_at (timestamp, default now)  
- updated_at (timestamp, default now)  

#### ai_chunks / master_chunks (DEPRECATED)
- Samme felt som `rag_chunks`, men uten PK/defaults  
- Beholdes midlertidig for trygghet / migrering  

#### chunks (DEPRECATED)
- Tidligere brukt i dev-scripts  
- Kan fases ut når alt er migrert til `rag_chunks`  

#### profiles
- id (uuid, PK fra auth.users)  
- role (text, default 'user')  
- email (text)  
- name (text)  
- avatar_url (text)  
- created_at (timestamp, default now)  
- updated_at (timestamp, default now via trigger)  

#### rag_usage
- id (bigint, PK)  
- created_at (timestamp, default now)  
- doc_id (int, FK → documents.id)  
- source_type (text)  
- hits (int, default 0)  
- route (text, default '/api/rag/chat')  

### 2.3 Policies (RLS)
- documents: altfor åpent (anon kan lese/insert/update) → bør strammes inn  
- profiles: kun eier kan lese/endre seg selv  
- rag_chunks: kun service_role kan skrive, authenticated kan lese  

### 2.4 Triggere & funksjoner
- handle_new_user: lager profil ved ny auth-bruker (SECURITY DEFINER)  
- profiles_set_updated_at: setter `updated_at` via trigger  
- handle_updated_at: setter `updated_at` via trigger  

### 2.5 Indekser
- rag_chunks: ivfflat på embedding + unik `(doc_id, source_type, chunk_index)`  
- documents: unik på doc_number  
- rag_usage: indekser på created_at, doc_id, source_type  
- chunks: gamle indekser finnes fortsatt (kan fjernes når tabellen slettes)  

### 2.6 Extensions
- vector 0.8.0 (for embeddings)  
- pg_graphql  
- pgcrypto  
- uuid-ossp  
- supabase_vault  
- pg_stat_statements  

---

## 3. Arkitektur og flyt

### 3.1 Dokumenter & RAG
1. Dokument lastes opp i admin → Supabase Storage  
2. syncMissingFiles() → registrerer i `documents`  
3. chunker.js → splitter i chunks, lagrer i `rag_chunks` med embeddings  
4. Chatbot → `rag/search.js` henter relevante chunks (semantic search via vector)  
5. GPT får kontekst + brukerinput → svar lagres (foreløpig ikke i DB)  

### 3.2 Chatter (planlagt)
1. Bruker starter → `chat_sessions` opprettes  
2. Meldinger → lagres i `chat_messages`  
3. Kontekstkobling → `message_context_links` binder meldinger til chunks  
4. Preferanser → `session_settings`  
5. Langsiktig minne → `user_memory`  

---

## 4. Utfordringer og feller
- PK mangler i `ai_chunks`/`master_chunks` → bør enten legges til eller fases ut  
- embedding-kolonner er “USER-DEFINED” → må sikres som `vector(1536)`  
- created_at/updated_at mangler konsistens på noen tabeller  
- documents RLS altfor åpent (anon kan gjøre alt)  
- chat_messages m.fl. mangler → loggføring ikke mulig ennå  
- legacy-kode: `chunks` brukt i 2 filer → nå rettet til `rag_chunks`  

---

## 5. Neste steg
1. Opprette tabeller for logging (`chat_sessions`, `chat_messages`, `message_context_links`, `session_settings`, `user_memory`)  
2. Stramme inn RLS på `documents`  
3. Standardisere embeddings → `vector(1536)` overalt  
4. Fjerne gamle tabeller etter at vi er trygge (evt. beholde views for kompatibilitet)  
5. Lage views / dashboard for status og analyser  

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

---

## 7. Ideer på pause (Fremtidslogg)
- Video-avatar i chatboten (spesielt NullFilter)  
- Samtykkeskjema + e-post-oppfølging  
- Integrasjon med Kajabi / Make / Notion  
- Personlig oppfølging (se gamle samtaler, hente opp historikk)  
- Dashboard med RAG-treff, mest brukte dokumenter, antall samtaler  
- Fremtidig premium-versjon med GPT-5, minnefunksjon og personlig oppfølging  

---

## 8. Changelog

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
