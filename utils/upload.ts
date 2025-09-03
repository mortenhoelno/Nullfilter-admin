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

  // 2) Regn ut SHA-256 hash
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // 3) Last opp til Storage
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

  // 4) Oppdater flagg + path + sha256 i DB
  const patch = {
    source_path: storagePath,
    sha256,
    ...(kind === 'master' ? { has_master: true } : { has_ai: true }),
  };

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

  return { storagePath, sha256, document: data };
}
