import { supabase } from './supabase';

export async function upsertDocument({
  docNumber,
  title,
  category,
  theme,
  version = 'v1',
  source = 'admin',
}: {
  docNumber: number;
  title: string;
  category?: string | null;
  theme?: string | null;
  version?: string;
  source?: string | null;
}) {
  const { data, error } = await supabase
    .from('documents')
    .upsert(
      [{
        doc_number: docNumber,
        title,
        category: category ?? null,
        theme: theme ?? null,
        version,
        source,
      }],
      { onConflict: 'doc_number' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
