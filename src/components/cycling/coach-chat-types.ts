// ── Pure logic for the "Stella" coach chat ──────────────────────────────

export type ChatRole = 'user' | 'assistant'

export interface ChatMessageLike {
  role: ChatRole
  content: string
}

// Bounds how much history is sent to Claude on each turn — the full
// conversation stays in Firestore for display, but re-sending an
// unbounded transcript on every message would grow latency/cost linearly
// with conversation length for no real benefit (the coach context block
// already re-establishes the durable facts every turn).
const MAX_HISTORY_MESSAGES = 20

/**
 * Trims a full message history down to the trailing window sent to the
 * model, always keeping the most recent messages (oldest-first order
 * preserved). A no-op when the history is already within the limit.
 */
export function trimChatHistoryForPrompt<T extends ChatMessageLike>(
  messages: T[],
  maxMessages: number = MAX_HISTORY_MESSAGES
): T[] {
  if (messages.length <= maxMessages) return messages
  return messages.slice(messages.length - maxMessages)
}

/** Whether a chat input is worth sending — not empty/whitespace-only. */
export function isSendableChatMessage(text: string): boolean {
  return text.trim().length > 0
}
