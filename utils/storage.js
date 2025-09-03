// FERDIG VERSJON: src/utils/storage.js med Supabase-integrasjon

import { supabaseBrowser } from './supabaseClient';
const supabase = supabaseBrowser();

import { TABLES, conversationFields, messageFields } from "../config/supabaseSchema";

export const createConversation = async (email, bot = "nullfilter") => {
  const { data, error } = await supabase
    .from(TABLES.conversations)
    .insert({
      [conversationFields.email]: email,
      [conversationFields.bot]: bot,
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Feil ved opprettelse av samtale:", error);
    return null;
  }

  console.log("📝 Ny samtale opprettet:", data);
  return data;
};

export const saveMessage = async (conversationId, message) => {
  const { role, content } = message;

  const { error } = await supabase.from(TABLES.messages).insert({
    [messageFields.conversation_id]: conversationId,
    [messageFields.role]: role,
    [messageFields.content]: content,
  });

  if (error) {
    console.error("❌ Feil ved lagring av melding:", error);
  } else {
    console.log("💬 Melding lagret for:", conversationId);
  }
};

export const getConversationByEmail = async (email, bot = "nullfilter") => {
  const { data, error } = await supabase
    .from(TABLES.conversations)
    .select("*")
    .eq(conversationFields.email, email)
    .eq(conversationFields.bot, bot)
    .order(conversationFields.created_at, { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.warn("📭 Fant ingen samtale for:", email);
    return null;
  }

  console.log("📂 Eksisterende samtale funnet:", data);
  return data;
};
