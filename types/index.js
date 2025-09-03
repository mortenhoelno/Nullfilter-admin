// Message
{ role: 'user' | 'assistant', content: string, ts?: string }

// Conversation
{ id: string, email?: string, messages: Message[] }

// UserPrefs
{ email: string, consentToFollowUp: boolean }
