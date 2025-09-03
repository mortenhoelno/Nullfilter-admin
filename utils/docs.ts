// utils/docs.ts
import { supabase } from "./supabase";              // server-klient
import { supabaseBrowser } from "./supabaseClient"; // nettleser-klient (ANON) for lesing

/** DB-modell for documents-tabellen */
export type DbDocument = {
  id: string;               // uuid
  title: string;
  doc_number: number;
  category?: string | null;
  theme?: string | null;
  version?: string | null;
  source?: string | null;
  has_master?: boolean;
  has_ai?: boolean;
  source_path?: string | null;
  sha256?: string | null;
  created_at?: string | null;
};

/**
 * Opprett/oppdater dokument-metadata
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
 * Hent alle dokumenter fra DB for visning i admin (nettleser/ANON)
 */
export async function listDocuments(): Promise<DbDocument[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("documents")
    .select("*", { head: false }) // hindrer cache
    .order("doc_number", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbDocument[];
}

/**
 * Gruppér dokumenter pr. doc_number
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
    if (r.has_master) g.master = r;
    if (r.has_ai) g.ai = r;
    map.set(r.doc_number, g);
  }
  return Array.from(map.values()).sort((a, b) => a.docNumber - b.docNumber);
}

/**
 * Sett/oppdater tittel for dokument (AI eller Master)
 */
export async function setTitleForKind(params: {
  docNumber: number;
  isMaster: boolean;
  title: string;
}) {
  const { docNumber, isMaster, title } = params;

  const patch = {
    title,
    source: "admin",
  };

  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("doc_number", docNumber)
    .eq(isMaster ? "has_master" : "has_ai", true) // viktig for å treffe riktig rad
    .select()
    .single();

  if (error) throw error;
  return data as DbDocument;
}


/**
 * Synkroniser databasen med faktiske filer i storage
 * Sletter ikke rader, men oppdaterer has_ai / has_master etter hva som faktisk finnes
 */
export async function syncMissingFiles() {
  const folder = "documents";
  const { data: files, error: fileErr } = await supabase.storage.from("storage").list(folder, { limit: 1000 });

  if (fileErr) throw new Error("Kunne ikke hente lagrede filer fra storage");

  const { data: rows, error: dbErr } = await supabase.from("documents").select("*");
  if (dbErr) throw new Error("Kunne ikke hente dokumenter fra database");

  const fileMap = new Map<number, { has_ai: boolean; has_master: boolean }>();

  for (const file of files ?? []) {
    const match = file.name.match(/^(\d+)-(ai|master)\./);
    if (!match) continue;
    const num = parseInt(match[1], 10);
    const kind = match[2] as "ai" | "master";

    const current = fileMap.get(num) ?? { has_ai: false, has_master: false };
    if (kind === "ai") current.has_ai = true;
    if (kind === "master") current.has_master = true;
    fileMap.set(num, current);
  }

  const updates: Partial<DbDocument & { doc_number: number }>[] = [];

  for (let i = 1; i <= 50; i++) {
    const existing = rows.find((r) => r.doc_number === i);
    const status = fileMap.get(i) ?? { has_ai: false, has_master: false };

    if (existing) {
      // Oppdater eksisterende rad
      updates.push({
        doc_number: i,
        has_ai: status.has_ai,
        has_master: status.has_master,
      });
    } else if (status.has_ai || status.has_master) {
      // Opprett ny rad hvis fil finnes, men rad mangler
      updates.push({
        doc_number: i,
        title: "(Importert)",
        has_ai: status.has_ai,
        has_master: status.has_master,
        source: "sync",
        version: "v1",
      });
    }
  }

  if (updates.length > 0) {
    const { error: upsertErr } = await supabase.from("documents").upsert(updates, {
      onConflict: "doc_number",
    });
    if (upsertErr) throw new Error("Feil ved synkronisering: " + upsertErr.message);
  }
}
