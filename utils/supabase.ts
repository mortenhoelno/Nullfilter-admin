// utils/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Klient for bruk i NETTLESER (lese-data med ANON key).
 * Bruk denne til listDocuments() osv.
 */
export const supabaseBrowser = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
