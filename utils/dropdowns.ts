// utils/dropdowns.ts
import { supabase } from "./supabase";

/**
 * Hent alle verdier for en gitt type (title, category, theme).
 * Returnerer en unik, sortert liste med strenger.
 */
export async function listDropdownValues(type: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("dropdown_values")
    .select("value")
    .eq("type", type)
    .order("value");

  if (error) {
    console.error(`Feil ved henting av dropdown_values for type=${type}:`, error);
    return [];
  }

  return data.map((d) => d.value).filter((v): v is string => !!v);
}

/**
 * Legg til en ny verdi i dropdown_values (unik per type).
 * Hvis verdien allerede finnes → ingen duplisering (upsert).
 */
export async function addDropdownValue(type: string, value: string): Promise<void> {
  if (!value || !type) return;

  const { error } = await supabase
    .from("dropdown_values")
    .upsert({ type, value }, { onConflict: "type,value" });

  if (error) {
    console.error(`Feil ved lagring av dropdown_value (type=${type}, value=${value}):`, error);
  }
}
