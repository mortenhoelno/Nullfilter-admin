
# 📁 Nullfilter AI Veileder – Prosjektstruktur (Optimalisert)

Dette dokumentet gir en optimal rekkefølge og oppdeling av funksjoner og utviklingsfaser for din AI-veilederplattform.  
Endringer og forbedringer fra tidligere struktur er kommentert.

---

## ✅ Fase 1: Grunnmur og kjernefunksjoner

| ID   | Tittel                            | Beskrivelse                                                               | Avhengigheter | Rolle                    | Varighet |
|------|-----------------------------------|---------------------------------------------------------------------------|----------------|--------------------------|----------|
| 1.1  | Oppsett av kjernesystemer         | GPT, Vercel, Supabase installeres og testes                              | –              | DevOps, Backend          | 3 dager  |
| 1.2  | Dokumentstruktur og RAG-pipeline  | Chunking og embedding av dokumenter                                       | 1.1            | AI Engineer              | 4 dager  |
| 1.3  | Logging og samtalestruktur        | Logging av sessions, meldinger, og dokumentreferanser                     | 1.1            | Backend                  | 2 dager  |
| 1.4  | PersonaConfig og fargevalg        | Oppsett av botens stemme og UI-farger                                     | 1.1            | Prompt Engineer, Frontend| 2 dager  |
| 1.5  | Adminpanel v0                     | Viser sessions, svar, RAG-bruk, FAQ-logging                               | 1.3            | Backend, Frontend        | 3 dager  |
| 1.6  | Brukerprofil + minne              | Navn, alder, mål, utfordringer, preferanser                              | 1.1            | Backend                  | 3 dager  |

---

## 🚀 Fase 2: MVP og brukeropplevelse

| ID   | Tittel                            | Beskrivelse                                                               | Avhengigheter | Rolle                    | Varighet |
|------|-----------------------------------|---------------------------------------------------------------------------|----------------|--------------------------|----------|
| 2.1  | Basis-chat                        | GPT-chat med personlig tone, brukerdata og dokumentbruk                   | 1.2, 1.3, 1.6   | Backend, AI, Frontend    | 5 dager  |
| 2.2  | Refleksjonslogg                   | Logging av ukesrefleksjoner og måloppnåelse                               | 2.1            | Frontend, AI             | 2 dager  |
| 2.3  | Gratis testbot                    | Begrenset bot med f.eks. 5 spørringer per bruker                          | 2.1            | Backend, Frontend        | 2 dager  |
| 2.4  | Ressursvisning                    | Mulighet for GPT å vise PDF-er, videoer, lyd, memes og linker             | 2.1            | Frontend, Backend        | 3 dager  |

---

## 🧠 Fase 3: Forbedring og utvidelse

| ID   | Tittel                            | Beskrivelse                                                               | Avhengigheter | Rolle                    | Varighet |
|------|-----------------------------------|---------------------------------------------------------------------------|----------------|--------------------------|----------|
| 3.1  | Statisk FAQ                       | Enkel FAQ-database og UI-komponent                                        | 2.1            | Backend, Admin           | 2 dager  |
| 3.2  | Inntaksskjema til personlig bot   | Form eller AI-samtale som konfigurerer botens personlighet og mål        | 2.1            | Frontend, AI             | 3 dager  |
| 3.3  | Challenge- og påminnelsessystem   | E-post/SMS-påminnelser med fremdrift                                     | 3.2            | Backend, Integrasjoner   | 3 dager  |

---

## 🌟 Fremtidige moduler og skalering

| ID   | Tittel                            | Beskrivelse                                                               | Avhengigheter | Rolle                    | Varighet |
|------|-----------------------------------|---------------------------------------------------------------------------|----------------|--------------------------|----------|
| 4.1  | Video/Avatar-generator            | Svar som video-avatar (eks. Synthesia/Gemini)                             | 2.4            | Integrasjon, Design      | ?        |
| 4.2  | Flerspråklig støtte               | Automatisk oversettelse og språkmodellvalg                               | 2.1            | AI, Frontend             | ?        |
| 4.3  | White-label bot-portal            | Mulighet for at andre coacher får sin egen versjon                       | 3.3            | Backend, Admin           | ?        |

---

🧭 **Tips for fremdrift:**
- Hold *Fase 1* supermodulær og testbar fra dag 1.
- Ikke overinvester i frontend før RAG og logging fungerer stabilt.
- Start med minimal versjon av adminpanel – utvid senere.
- Bygg `2.1` og `2.3` som demo/landingsside til investorer eller testere.

