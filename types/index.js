// Message
{ role: 'user' | 'assistant', content: string, ts?: string }

// Conversation
{ id: string, email?: string, messages: Message[] }

// UserPrefs
{ email: string, consentToFollowUp: boolean }
// Message
{ 
  role: 'user' | 'assistant', 
  content: string, 
  ts?: string,
  response_ms?: number // ⏱️ Nytt felt for responstid i millisekunder
}

// Conversation
{ 
  id: string, 
  email?: string, 
  messages: Message[] 
}

// UserPrefs
{ 
  email: string, 
  consentToFollowUp: boolean 
}
