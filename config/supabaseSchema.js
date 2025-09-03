// FERDIG VERSJON: config/supabaseSchema.js

export const TABLES = {
  conversations: "chat_conversations",
  messages: "chat_messages",
};

export const conversationFields = {
  id: "id",
  email: "email",
  bot: "bot", // f.eks. 'nullfilter', 'keepertrening'
  created_at: "created_at",
};

export const messageFields = {
  id: "id",
  conversation_id: "conversation_id",
  role: "role", // 'user' eller 'assistant'
  content: "content",
  created_at: "created_at",
};
