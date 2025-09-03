import { supabase } from "./supabase";
import { supabaseBrowser } from "./supabaseClient";

/** DB-modell for documents-tabellen (Supabase-skjemaet vårt) */
export type DbDocument = {
  id: string;               // uuid
  title: string;
  doc_number: number;
  category?: string | null;
  theme?: string | null;
  version?: string | null;
  source?: string | null;
  is_master?: boolean | null;
  source_path?: string | null;
  sha256?: string | null;
  created_at?: string;
};

/**
 * Opprett eller oppdater dokument (metadata).
 * Dette er din eksisterende funksjon – beholdt som den var.
 */
export async function upsertDocument({
  docNumber,
  title,
  category,
  theme,
  version = "v1",
  source = "admin",
}: {
  docNumber: number;
  title: string;
  category?: string | null;
  theme?: string | null;
  version?: string;
  source?: string | null;
}) {
  const { data, error } = await supabase
    .from("documents")
    .upsert(
      [
        {
          doc_number: docNumber,
          title,
          category: category ?? null,
          theme: theme ?? null,
          version,
          source,
        },
      ],
      { onConflict: "doc_number" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DbDocument;
}

/**
 * Hent alle dokumenter fra databasen
 */
export async function listDocuments(): Promise<DbDocument[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("documents")
    .select("*")
    .order("doc_number", { ascending: true })
    .order("is_master", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbDocument[];
}

/**
 * Gruppér dokumenter pr. doc_number slik at Master/AI havner sammen
 */
export type DocGroup = {
  docNumber: number;
  master?: DbDocument;
  ai?: DbDocument;
};

export function groupByDocNumber(rows: DbDocument[]): DocGroup[] {
  const map = new Map<number, DocGroup>();
  for (const r of rows) {
    const g = map.get(r.doc_number) ?? { docNumber: r.doc_number };
    if (r.is_master) g.master = r;
    else g.ai = r;
    map.set(r.doc_number, g);
  }
  return Array.from(map.values()).sort((a, b) => a.docNumber - b.docNumber);
}
