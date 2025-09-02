import { supabase } from './supabase';
import { storageBucket, pathFor } from './storagePaths';
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

  // 1) Lag trygg (sanitert) path/filnavn for Storage
  const safeName = sanitizeFileName(file.name);
  const storagePath = pathFor(kind, docNumber, safeName);

  // 2) Last opp til riktig mappe i Storage
  const { error: upErr } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, file, {
      upsert: true, // krever UPDATE-policy på storage.objects
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    });

  if (upErr) {
    // Litt ekstra info for feilsøk i nettleserkonsollen
    console.error('Storage upload error:', upErr, { storagePath, originalName: file.name, safeName });
    throw upErr;
  }

  // 3) Oppdater flagg i DB etter vellykket opplasting
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
