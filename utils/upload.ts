import { supabase } from './supabase';
import { storageBucket } from './storagePaths';
import { sanitizeFileName } from './sanitize';

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

  // 1) Lag trygg (sanitert) filnavn
  const safeName = sanitizeFileName(file.name);

  // NB: Bygg hele pathen manuelt (ikke bruk pathFor som tar original)
  const storagePath = `${kind}/${docNumber}/${safeName}`;

  // 2) Last opp til Storage
  const { error: upErr } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });

  if (upErr) {
    console.error('Storage upload error:', upErr, { storagePath, originalName: file.name, safeName });
    throw upErr;
  }

  // 3) Oppdater flagg i DB
  const patch = kind === 'master' ? { has_master: true } : { has_ai: true };

  const { data, error: updErr } = await supabase
    .from('documents')
    .update(patch)
    .eq('doc_number', docNumber)
    .select()
    .single();

  if (updErr) {
    console.error('DB update error:', updErr, { docNumber, patch });
    throw updErr;
  }

  return { storagePath, document: data };
}
