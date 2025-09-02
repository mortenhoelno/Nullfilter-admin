import { supabase } from './supabase';
import { storageBucket, pathFor } from './storagePaths';

export async function uploadAndFlag({
  file,
  docNumber,
  kind,
}: {
  file: File;
  docNumber: number;
  kind: 'master' | 'ai';
}) {
  if (!file) throw new Error('Velg en fil først.');
  if (!docNumber) throw new Error('docNumber mangler.');

  // 1) last opp til riktig mappe i Storage
  const storagePath = pathFor(kind, docNumber, file.name);
  const { error: upErr } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
  if (upErr) throw upErr;

  // 2) oppdater flagg i DB
  const patch = kind === 'master' ? { has_master: true } : { has_ai: true };

  const { data, error: updErr } = await supabase
    .from('documents')
    .update(patch)
    .eq('doc_number', docNumber)
    .select()
    .single();

  if (updErr) throw updErr;

  return { storagePath, document: data };
}
