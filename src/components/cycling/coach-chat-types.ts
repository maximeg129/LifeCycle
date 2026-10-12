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

/**
 * Normalise un fait de mémoire coach pour une comparaison de quasi-doublon
 * — trim, minuscules, accents retirés, espaces multiples réduits à un
 * seul, ponctuation de fin retirée. Revue externe (UX/engine) : "Faits
 * retenus" holds the same training fact 3 times" — `add_remembered_fact`
 * (use-coach-chat.ts) écrit via `arrayUnion`, qui ne dédoublonne que des
 * chaînes EXACTEMENT identiques ; le modèle reformule souvent le même fait
 * légèrement différemment d'un tour à l'autre ("Dort environ 7h par nuit"
 * vs "L'athlète dort en moyenne 7 heures par nuit"), qu'`arrayUnion` ne
 * reconnaît jamais comme doublon. Volontairement PAS une similarité
 * sémantique/par embedding (aucune infra d'embedding dans cette app,
 * coûterait un appel réseau supplémentaire pour un geste qui doit rester
 * instantané) — seulement les quasi-doublons mécaniques (casse/accents/
 * espacement/ponctuation), le cas le plus fréquent en pratique.
 */
export function normalizeFactForDedup(fact: string): string {
  return fact
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
}

/** `true` si `fact` (une fois normalisé) correspond déjà à l'un de `existingFacts` — voir normalizeFactForDedup. */
export function isDuplicateFact(fact: string, existingFacts: string[]): boolean {
  const normalized = normalizeFactForDedup(fact)
  return existingFacts.some((f) => normalizeFactForDedup(f) === normalized)
}
