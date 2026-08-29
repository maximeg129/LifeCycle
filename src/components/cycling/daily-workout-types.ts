// ── Pure logic for the "Proposition du jour" daily workout flow ────────
//
// Kept separate from use-daily-workout.ts (the Firebase/Intervals glue) so
// the actual decision logic — clamping user input, summarizing recent
// sessions for the AI prompt, building the Intervals.icu push payload — is
// unit-testable without mocking React/Firebase (see CLAUDE.md convention).

import { format, subDays } from 'date-fns'
import type { PlannedWorkoutEvent } from '@/lib/intervals-api'
import type { DailyWorkoutRecommendationInput, DailyWorkoutRecommendationOutput } from '@/ai/flows/daily-workout-recommendation-flow'

const MIN_AVAILABLE_MINUTES = 15
const MAX_AVAILABLE_MINUTES = 360

/** Sanitizes the user-entered available-time input: whole minutes, within a sane 15min–6h range. */
export function clampAvailableMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_AVAILABLE_MINUTES
  const rounded = Math.round(minutes)
  return Math.min(MAX_AVAILABLE_MINUTES, Math.max(MIN_AVAILABLE_MINUTES, rounded))
}

export interface ActivityLike {
  start_date_local?: string | null
  type?: string | null
  moving_time?: number | null
  icu_training_load?: number | null
}

/**
 * Reduces raw Intervals.icu activities to the lean per-session summary the
 * AI flow's prompt needs (date/type/duration/load), for the N days before
 * `referenceDateStr` (yyyy-MM-dd). Oldest first, matching how the flow's
 * prompt renders them.
 */
export function summarizeRecentSessions(
  activities: ActivityLike[],
  referenceDateStr: string,
  windowDays = 7
): DailyWorkoutRecommendationInput['recentSessions'] {
  const referenceDate = new Date(`${referenceDateStr}T00:00:00`)
  const oldest = subDays(referenceDate, windowDays).toISOString().slice(0, 10)

  return activities
    .filter((a) => {
      const d = a.start_date_local?.slice(0, 10)
      return !!d && d >= oldest && d <= referenceDateStr
    })
    .map((a) => ({
      date: (a.start_date_local as string).slice(0, 10),
      type: a.type ?? undefined,
      durationMinutes: a.moving_time != null ? Math.round(a.moving_time / 60) : undefined,
      trainingLoad: a.icu_training_load ?? undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Combines a date and "HH:mm" time input into the ISO-ish datetime string fetchWeatherForecast() expects — same shape as buildOutfitDateTime() in weather/clothing-types.ts, kept separate since it's a different domain (a departure time for today's proposal, not an arbitrary future outing). */
export function buildRideDateTime(date: Date, time: string): string {
  return `${format(date, 'yyyy-MM-dd')}T${time}:00`
}

/** Deterministic per-day Intervals.icu external id — re-sending the same day's (possibly edited) proposal upserts the calendar entry instead of duplicating it. */
export function dailyWorkoutExternalId(dateId: string): string {
  return `lifecycle-daily-${dateId}`
}

/** Builds the Intervals.icu calendar-push payload from a generated (and possibly user-edited) proposal. */
export function buildWorkoutEventPayload(
  proposal: Pick<DailyWorkoutRecommendationOutput, 'title' | 'sportType' | 'durationMinutes' | 'structuredWorkout'>,
  dateId: string
): PlannedWorkoutEvent {
  return {
    externalId: dailyWorkoutExternalId(dateId),
    name: proposal.title,
    sportType: proposal.sportType || 'Ride',
    startDateLocal: dateId,
    description: proposal.structuredWorkout,
    durationSeconds: proposal.durationMinutes > 0 ? proposal.durationMinutes * 60 : undefined,
  }
}
