import { Timestamp } from 'firebase/firestore'

// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

export type InjuryStatus = 'active' | 'resolved'

export interface Injury {
  userId: string
  bodyRegion: string
  severity: number // 1 (légère) – 5 (sévère)
  status: InjuryStatus
  startDate: string // ISO date, yyyy-MM-dd
  description: string
  physioInstructions: string
  createdAt: Timestamp
}

export interface CoachLifestyle {
  stress?: string
  sleepHabits?: string
  workConstraints?: string
  notes?: string
  updatedAt?: unknown
}

export interface CoachGoal {
  userId: string
  eventName: string
  eventDate: string // ISO date, yyyy-MM-dd
  targetOutcome: string
  priority: number // 1 (prioritaire) – 3 (secondaire)
  createdAt: Timestamp
}

export interface CoachFacts {
  items: string[]
  updatedAt?: unknown
}

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
  active: 'Active',
  resolved: 'Résolue',
}

export const GOAL_PRIORITY_LABELS: Record<number, string> = {
  1: 'Prioritaire',
  2: 'Secondaire',
  3: 'Optionnel',
}

// ── Pure helpers (unit-tested, no Firebase deps) ─────────────────────────

export function countActiveInjuries(injuries: Pick<Injury, 'status'>[]): number {
  return injuries.filter((i) => i.status === 'active').length
}

/** Upcoming goals (eventDate >= todayIso), soonest first. */
export function upcomingGoals<T extends Pick<CoachGoal, 'eventDate'>>(goals: T[], todayIso: string): T[] {
  return goals.filter((g) => g.eventDate >= todayIso).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
}

export function hasLifestyleContent(lifestyle: CoachLifestyle | null | undefined): boolean {
  if (!lifestyle) return false
  return !!(lifestyle.stress || lifestyle.sleepHabits || lifestyle.workConstraints || lifestyle.notes)
}
