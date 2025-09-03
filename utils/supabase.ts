// utils/supabase.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Klient for bruk fra nettleser/klientkode (ANON).
 * Dette matcher importen i utils/docs.ts: `import { supabase } from "./supabase"`
 * Hvis RLS krever mer rettigheter for upsert, flytter vi det til en API-route i neste steg.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);
