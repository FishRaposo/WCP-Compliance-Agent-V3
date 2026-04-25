// Future: Conversation memory for multi-turn WCP analysis sessions.
// Will use Mastra memory primitives when implemented.

export interface ConversationMemory {
  sessionId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  jobIds: string[];
}
