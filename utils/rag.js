// utils/rag.js — FERDIG VERSJON (DB-kall med detaljert timing)
// Dette modulerer tre ting:
//  1) getDbClient() – enkel klient med .query(sql, params) via HTTP-proxy (DB_HTTP_URL)
//  2) vectorQuery()  – RAG vektorsøk (pgvector) med perf-målinger
//  3) fetchDocsByIds() – Hent valgte chunks + dokumenttittel med perf-målinger
//
// Forventet skjema (tilpass ved behov):
//  - public.documents (id uuid PK, title text, ...)
//  - public.rag_chunks (id bigint PK, doc_id uuid FK → documents.id, title text, content text, embedding vector(1536))
//  - pgvector installert og (anbefalt) IVFFLAT index på rag_chunks(embedding)
//
// Kjøring av SQL:
//  - Sett opp en sikker HTTP-endepunkt (Edge Function) som tar JSON: { sql, params } og returnerer { rows }
//  - Konfigurer env:
//      DB_HTTP_URL    = https://<your-edge-function-url>
//      DB_HTTP_TOKEN  = <bearer token> (f.eks. service role eller egen secret for funksjonen)
//
// NB: Hvis du allerede har en native klient (pg / supabase-js med SQL-proxy), kan du erstatte implementasjonen av query().

import { startPerf } from "./perf";

// --- Enkel cache av klient ---
let cachedDb = null;

/**
 * getDbClient()
 * Returnerer en klient med .query(sql, params) som kaller et internt HTTP-endepunkt.
 * @returns {Promise<{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }>}
 */
export async function getDbClient() {
  if (cachedDb) return cachedDb;

  const baseUrl = process.env.DB_HTTP_URL;
  const token = process.env.DB_HTTP_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "DB_HTTP_URL/DB_HTTP_TOKEN mangler. Sett disse env-variablene eller bytt implementasjon av getDbClient()."
    );
  }

  // Minimal HTTP-klient. Du kan bytte ut med pg/supabase-js ved behov.
  const client = {
    async query(sql, params = []) {
      const resp = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`DB HTTP ${resp.status}: ${txt || "<no body>"}`);
      }
      const json = await resp.json();
      // forventer { rows: [...] }
      if (!json || typeof json !== "object" || !("rows" in json)) {
        throw new Error("Ugyldig DB-svar – forventet { rows: [...] }");
      }
      return json; // { rows }
    },
  };

  cachedDb = client;
  return client;
}

/**
 * vectorQuery()
 * Kjører selve vektorsøket. To mulige tilnærminger (velg én og kommenter ut den andre):
 *  A) Hvis du har en SQL-funksjon embed_text($1) som returnerer vector(1536):
 *     - Bruk cosine-similaritet via <#> eller egen similarity-funksjon.
 *  B) Hvis du IKKE har embed_text(): forutsetter at du har pre-embedda spørringer eller kjører embedding i appen.
 *     - I så fall må 'queryEmbedding' sendes inn som vector (float[]), og SQL må tilpasses.
 *
 * Nedenfor viser vi (A) med embed_text($1) + cosine (<#>) der lavere er bedre. Vi inverterer til "similarity".
 *
 * @param {object} db - klient fra getDbClient()
 * @param {string} queryText - Brukerens spørring
 * @param {{ topK?: number, minSim?: number }} options
 * @returns {Promise<{ ids: number[], rows: any[] }>}
 */
export async function vectorQuery(db, queryText, { topK = 6, minSim = 0.0 } = {}) {
  // SQL forklaring:
  //  - distance = embedding <#> embed_text($1)  (cosine distance, 0 = likt, 2 = ulikt)
  //  - similarity = 1 - (distance / 2)         (mappe til [0..1], høyere = bedre)
  //  - filtrer på minSim hvis ønskelig
  //
  // Index:
  //  CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivf
  //    ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops)
  //    WITH (lists = 100);
  //
  const sql = `
    with q as (
      select embed_text($1) as qvec
    )
    select
      c.id,
      c.doc_id,
      coalesce(c.title, '')           as chunk_title,
      coalesce(c.content, '')         as content,
      d.title                         as doc_title,
      /* cosine distance (0 best) */
      (c.embedding <#> q.qvec)        as distance,
      /* map distance→similarity: 1 - distance/2 (cosine range [0..2]) */
      (1 - ((c.embedding <#> q.qvec) / 2.0)) as similarity
    from public.rag_chunks c
    join public.documents d on d.id = c.doc_id
    join q on true
    where c.embedding is not null
      and (1 - ((c.embedding <#> q.qvec) / 2.0)) >= $2
    order by distance asc
    limit $3
  `;
  const params = [queryText, minSim, topK];

  // Perf: mål SQL-tid og nettverkskost for spørringen
  const perf = startPerf("db_vector_query");
  perf.mark("sql_send");
  const { rows } = await db.query(sql, params);
  perf.measure("sql_recv", "sql_send");
  perf.mark("__end");
  const snap = perf.snapshot({ rows: rows.length });
  // Logg i dev for å se ren DB-tid per spørring
  // (Kan skrus av hvis det blir for mye støy)
  // console.debug("[DB vectorQuery PERF]", JSON.stringify(snap));

  return {
    ids: rows.map((r) => r.id),
    rows,
  };
}

/**
 * fetchDocsByIds()
 * Henter innholdet for gitte chunk-IDs + dokumenttittel. Sorterer i samme rekkefølge som IDs.
 * @param {object} db
 * @param {number[]} ids
 * @returns {Promise<Array<{ id: number, title: string, content: string }>>}
 */
export async function fetchDocsByIds(db, ids) {
  if (!ids?.length) return [];

  // Bruk unnest for å bevare rekkefølge fra ids-array
  const sql = `
    with wanted as (
      select unnest($1::bigint[]) as id, generate_series(1, array_length($1::bigint[], 1)) as ord
    )
    select
      c.id,
      coalesce(d.title, c.title, concat('Chunk ', c.id::text)) as title,
      coalesce(c.content, '') as content,
      w.ord
    from wanted w
    join public.rag_chunks c on c.id = w.id
    left join public.documents d on d.id = c.doc_id
    order by w.ord asc
  `;
  const params = [ids];

  const perf = startPerf("db_fetch_docs");
  perf.mark("sql_send");
  const { rows } = await db.query(sql, params);
  perf.measure("sql_recv", "sql_send");
  perf.mark("__end");
  const snap = perf.snapshot({ rows: rows.length });
  // console.debug("[DB fetchDocsByIds PERF]", JSON.stringify(snap));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
  }));
}

// utils/rag.js – LEGG TIL HELT NEDERST (behold alt annet som er i fila)
export async function getRagContext(db, queryText, { topK = 6, minSim = 0.0, sourceType = null } = {}) {
  // 1) vektorsøk
  const { ids } = await vectorQuery(db, queryText, { topK, minSim, sourceType });

  // 2) hent dokument-chunks i samme rekkefølge
  const docs = await fetchDocsByIds(db, ids);

  // 3) bygg kontekstdeler slik UI'en forventer
  const chunks = docs.map((d, i) => `### Doc ${i + 1}: ${d.title}\n${d.content}`);

  return {
    docs,          // array med { id, title, content }
    chunks,        // preformatert tekstblokker
    meta: { topK, returned: docs.length, minSim, sourceType },
  };
}

