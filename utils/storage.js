// Fil: src/utils/storage.js
// Dette er steg 2a: Lagre enkle lagrings-funksjoner (foreløpig bare stubber/logging)

export const createConversation = (email) => {
  const id = crypto.randomUUID();
  console.log("📝 Oppretter ny samtale for:", email);
  return { id, email, messages: [] };
};

export const saveMessage = (conversationId, message) => {
  console.log("💬 Lagrer melding til:", conversationId, message);
};

export const getConversationByEmail = (email) => {
  console.log("📂 Henter samtale for:", email);
  return null; // Her kan du simulere en tidligere samtale senere
};
