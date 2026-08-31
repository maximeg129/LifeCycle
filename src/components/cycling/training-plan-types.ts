// ── Pure logic for the mid/long-term periodized training plan ──────────
//
// Design choice: the AI is asked for the *content* of each week (phase,
// focus, target weekly volume) but never for calendar dates — date
// arithmetic is exactly the kind of thing LLMs get subtly wrong, and it's
// fully deterministic anyway. buildPlanWeekSkeleton() computes the real
// Monday-aligned week boundaries; mergePlanWeeks() zips the AI's per-week
// content onto that skeleton by index. Same separation of concerns as
// daily-workout-types.ts (AI content vs. deterministic mechanics).

import { addDays, format } from 'date-fns'
import { mondayOf } from './load-types'
import type { PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'

export type PlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery'

const MIN_WEEKLY_MINUTES = 60
const MAX_WEEKLY_MINUTES = 1500 // 25h/week

const MIN_PLAN_WEEKS = 2
const MAX_PLAN_WEEKS = 24 // ~6 months — beyond that, regenerating closer to the event is more accurate than a single long-range call.

/** Sanitizes the user-entered weekly-availability input (in minutes). */
export function clampWeeklyMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_WEEKLY_MINUTES
  const rounded = Math.round(minutes)
  return Math.min(MAX_WEEKLY_MINUTES, Math.max(MIN_WEEKLY_MINUTES, rounded))
}

/** Whole weeks between today and the event date (may be 0 or negative for a past/too-close event). */
export function weeksUntilEvent(todayIso: string, eventDateIso: string): number {
  const today = new Date(`${todayIso}T00:00:00`)
  const event = new Date(`${eventDateIso}T00:00:00`)
  const diffDays = Math.round((event.getTime() - today.getTime()) / 86400000)
  return Math.floor(diffDays / 7)
}

/** Clamps a raw week count to the range a single plan generation can sensibly cover. */
export function clampPlanWeeks(weeks: number): number {
  if (!Number.isFinite(weeks)) return MIN_PLAN_WEEKS
  return Math.min(MAX_PLAN_WEEKS, Math.max(MIN_PLAN_WEEKS, Math.round(weeks)))
}

export interface PlanWeekSkeleton {
  weekNumber: number
  startDate: string
  endDate: string
}

/** Deterministic Monday-aligned week boundaries for a plan starting on (the Monday of) startDateIso. */
export function buildPlanWeekSkeleton(startDateIso: string, numWeeks: number): PlanWeekSkeleton[] {
  const start = new Date(`${mondayOf(startDateIso)}T00:00:00`)
  const weeks: PlanWeekSkeleton[] = []
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = addDays(start, i * 7)
    const weekEnd = addDays(weekStart, 6)
    weeks.push({
      weekNumber: i + 1,
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
    })
  }
  return weeks
}

export interface PlanWeekContent {
  phase: PlanPhase
  focus: string
  targetWeeklyMinutes: number
  notes?: string
  /**
   * The coach's example sessions for this week — generated lazily (on
   * first expand, see useTrainingPlan.generateWeekSessions) and cached
   * here so re-opening the week doesn't re-call the AI. Absent until
   * generated; never regenerated automatically once present.
   */
  sampleSessions?: PlanWeekSession[]
}

export interface PlanWeek extends PlanWeekSkeleton, PlanWeekContent {}

/**
 * Zips the AI-generated per-week content onto the deterministic date
 * skeleton, by index. The skeleton's length is authoritative — if the
 * model returned a different number of weeks than asked, extra content is
 * dropped and any missing week falls back to a safe default rather than
 * crashing the UI.
 */
export function mergePlanWeeks(skeleton: PlanWeekSkeleton[], content: PlanWeekContent[]): PlanWeek[] {
  return skeleton.map((week, i) => {
    const c = content[i]
    const merged: PlanWeek = {
      ...week,
      phase: c?.phase ?? 'base',
      focus: c?.focus ?? '',
      targetWeeklyMinutes: c?.targetWeeklyMinutes ?? 0,
    }
    // Omit the key entirely rather than `notes: undefined` — most weeks have
    // no note (the AI is told to add one "only when something needs
    // flagging"), and Firestore's setDoc/updateDoc throws on an explicit
    // `undefined` field value anywhere in the payload, including nested
    // inside an array element. An explicit `notes: c?.notes` here used to
    // make the whole plan write (and any later week-sessions write, once it
    // spreads this object back) fail for any plan where at least one week
    // came back without a note — which is the common case, not the edge case.
    if (c?.notes) merged.notes = c.notes
    return merged
  })
}

/** The week containing todayIso, or null if today falls before the plan starts or after it ends. */
export function currentPlanWeek(weeks: PlanWeek[], todayIso: string): PlanWeek | null {
  return weeks.find((w) => todayIso >= w.startDate && todayIso <= w.endDate) ?? null
}

/**
 * Deterministic per-session Intervals.icu external id — date-independent
 * (unlike dailyWorkoutExternalId, keyed on the calendar day) so that
 * re-picking a date for the same plan/week/session slot moves the
 * calendar entry instead of duplicating it.
 */
export function planSessionExternalId(planId: string, weekNumber: number, sessionIndex: number): string {
  return `lifecycle-plan-${planId}-w${weekNumber}-s${sessionIndex}`
}

// ── Recalibration automatique — retour utilisateur du 31 août 2026 ────────
//
// "Serais t il possible de penser à automatique mais documentée on pourrais
// expliquer à l'athlète pourquoi le plan a changé. Également on garderais
// un trace du plan d'origine pour pouvoir comprendre les impacts des
// changement." Trois pièces : (1) un déclenchement automatique — pas de
// cron serveur dans cette app (Server Actions uniquement, voir CLAUDE.md),
// donc le déclenchement se fait côté client quand l'athlète ouvre l'onglet
// Plan, même patron que "Auto-trigger full sync on app load" déjà en place
// ailleurs ; (2) une explication ("summary"/"reasons" du contrat de sortie
// coach, même patron que le reste de cette PR) ; (3) une trace immuable du
// plan d'origine (TrainingPlanDoc.originalWeeks, capturé une seule fois à
// la création, jamais retouché par une recalibration).

export interface PlanWeekChange {
  weekNumber: number
  before: { phase: PlanPhase; focus: string; targetWeeklyMinutes: number }
  after: { phase: PlanPhase; focus: string; targetWeeklyMinutes: number }
}

/**
 * Une semaine du plan est due pour recalibration dès qu'elle est terminée
 * (endDate < todayIso) et qu'aucune recalibration précédente ne l'a déjà
 * prise en compte (son numéro > le plus grand `throughWeekNumber` déjà
 * traité) — ET qu'il reste au moins une semaine future à ajuster (sinon
 * rien à recalibrer, pas la peine d'appeler l'IA). Retourne le numéro de
 * la semaine la plus récente qui déclenche la recalibration, ou `null` si
 * rien n'est dû.
 */
export function weekNeedsRecalibration(
  weeks: PlanWeek[],
  recalibratedThroughWeek: number | null | undefined,
  todayIso: string
): number | null {
  const alreadyThrough = recalibratedThroughWeek ?? 0
  const completedWeeks = weeks.filter((w) => w.endDate < todayIso && w.weekNumber > alreadyThrough)
  if (completedWeeks.length === 0) return null

  const dueThroughWeek = Math.max(...completedWeeks.map((w) => w.weekNumber))
  const hasFutureWeek = weeks.some((w) => w.weekNumber > dueThroughWeek)
  if (!hasFutureWeek) return null

  return dueThroughWeek
}

/**
 * Volume réellement réalisé (minutes) sur la fenêtre d'une semaine du plan
 * — à partir des activités réelles Intervals.icu déjà récupérées ailleurs
 * dans l'app (jamais recalculé depuis une source différente). Une activité
 * "startDate" (yyyy-MM-dd) est comptée dans la semaine si elle tombe entre
 * `week.startDate` et `week.endDate` inclus.
 */
export function computeActualWeeklyMinutes(
  activities: { startDate: string; durationMinutes: number }[],
  week: PlanWeekSkeleton
): number {
  return activities
    .filter((a) => a.startDate >= week.startDate && a.startDate <= week.endDate)
    .reduce((sum, a) => sum + a.durationMinutes, 0)
}

/** Contenu ajusté d'une semaine, tel que renvoyé par trainingPlanRecalibration — mêmes champs qu'une PlanWeekContent sans sampleSessions (jamais régénérées automatiquement par une recalibration). */
export interface PlanWeekAdjustment {
  weekNumber: number
  phase: PlanPhase
  focus: string
  targetWeeklyMinutes: number
  notes?: string
}

/**
 * Ne retient que les semaines dont le contenu a réellement changé — une
 * recalibration qui confirme le plan existant sans rien modifier ne doit
 * pas produire un "changement" vide dans le journal.
 */
export function diffPlanWeeks(before: PlanWeek[], adjustments: PlanWeekAdjustment[]): PlanWeekChange[] {
  const changes: PlanWeekChange[] = []
  for (const adj of adjustments) {
    const prev = before.find((w) => w.weekNumber === adj.weekNumber)
    if (!prev) continue
    const changed = prev.phase !== adj.phase || prev.focus !== adj.focus || prev.targetWeeklyMinutes !== adj.targetWeeklyMinutes
    if (!changed) continue
    changes.push({
      weekNumber: adj.weekNumber,
      before: { phase: prev.phase, focus: prev.focus, targetWeeklyMinutes: prev.targetWeeklyMinutes },
      after: { phase: adj.phase, focus: adj.focus, targetWeeklyMinutes: adj.targetWeeklyMinutes },
    })
  }
  return changes
}

/**
 * Applique les ajustements aux semaines concernées — garde le squelette de
 * dates intact (jamais retouché par l'IA, voir buildPlanWeekSkeleton), et
 * vide `sampleSessions` sur toute semaine dont le contenu a changé : les
 * séances type déjà mises en cache l'ont été pour l'ANCIEN targetWeeklyMinutes/
 * phase, les laisser en place induirait en erreur plutôt que de simplement
 * les régénérer à la prochaine ouverture (même patron lazy que la première
 * génération, voir generateWeekSessions dans use-training-plan.ts). Les
 * semaines déjà passées (weekNumber <= throughWeekNumber) ne sont jamais
 * dans `adjustments` et donc jamais touchées.
 */
export function applyRecalibration(weeks: PlanWeek[], adjustments: PlanWeekAdjustment[]): PlanWeek[] {
  const byWeekNumber = new Map(adjustments.map((a) => [a.weekNumber, a]))
  return weeks.map((w) => {
    const adj = byWeekNumber.get(w.weekNumber)
    if (!adj) return w
    const changed = w.phase !== adj.phase || w.focus !== adj.focus || w.targetWeeklyMinutes !== adj.targetWeeklyMinutes
    const updated: PlanWeek = { ...w, phase: adj.phase, focus: adj.focus, targetWeeklyMinutes: adj.targetWeeklyMinutes }
    if (adj.notes) updated.notes = adj.notes
    else delete updated.notes
    if (changed) delete updated.sampleSessions
    return updated
  })
}
