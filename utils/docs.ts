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
    .eq(isMaster ? "has_master" : "has_ai", true)
    .select()
    .single();

  if (error) throw error;
  return data as DbDocument;
}

/**
 * Synkroniser dokumenter i databasen med faktisk filstatus i Supabase Storage
 */
export async function syncMissingFiles(): Promise<void> {
  const { data: allDocs, error: docError } = await supabase.from("documents").select("*");
  if (docError) throw docError;

  const { data: aiFiles, error: aiErr } = await supabase.storage.from("ai").list("", { limit: 1000 });
  const { data: masterFiles, error: masterErr } = await supabase.storage.from("master").list("", { limit: 1000 });

  if (aiErr || masterErr) throw aiErr || masterErr;

  const aiSet = new Set(aiFiles?.map(f => f.name));
  const masterSet = new Set(masterFiles?.map(f => f.name));

  for (const doc of allDocs ?? []) {
    let shouldUpdate = false;
    const updates: Partial<DbDocument> = {};

    if (doc.has_ai && doc.source_path?.startsWith("ai/")) {
      const filename = doc.source_path.replace("ai/", "");
      if (!aiSet.has(filename)) {
        updates.has_ai = false;
        updates.source_path = null;
        updates.sha256 = null;
        shouldUpdate = true;
      }
    }

    if (doc.has_master && doc.source_path?.startsWith("master/")) {
      const filename = doc.source_path.replace("master/", "");
      if (!masterSet.has(filename)) {
        updates.has_master = false;
        updates.source_path = null;
        updates.sha256 = null;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      await supabase.from("documents").update(updates).eq("id", doc.id);
    }
  }
}
