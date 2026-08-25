import { Timestamp } from 'firebase/firestore'

// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

export type FeelingLevel = 'bien' | 'neutre' | 'mauvais'

export interface SessionFeedback {
  userId: string
  activityId?: string | null // Intervals.icu activity id, when tied to a session
  date: string // yyyy-MM-dd
  rpe?: number // 1-10, "distance par rapport au TTE" — not a vague sensation
  feeling?: FeelingLevel
  motivation?: FeelingLevel
  createdAt?: Timestamp
  updatedAt?: unknown
}

export const FEELING_LABELS: Record<FeelingLevel, string> = { bien: 'Bien', neutre: 'Neutre', mauvais: 'Mauvais' }
export const FEELING_EMOJI: Record<FeelingLevel, string> = { bien: '🙂', neutre: '😐', mauvais: '🙁' }
export const FEELING_SCORE: Record<FeelingLevel, number> = { bien: 1, neutre: 0, mauvais: -1 }

// ── Pure helpers (unit-tested, no Firebase deps) ─────────────────────────

/** Combined -1..1 score from feeling + motivation, averaged; null if neither is set. */
export function feelingScore(feeling?: FeelingLevel, motivation?: FeelingLevel): number | null {
  const values = [feeling, motivation].filter((v): v is FeelingLevel => !!v).map((v) => FEELING_SCORE[v])
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Firestore docId for a session tied to an Intervals.icu activity. */
export function feedbackDocIdForActivity(activityId: string): string {
  return activityId
}

/** Firestore docId for a standalone daily check-in (no specific session). */
export function feedbackDocIdForDay(dayId: string): string {
  return `daily-${dayId}`
}
