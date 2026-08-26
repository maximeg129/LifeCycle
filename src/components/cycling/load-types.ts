// ── kJ workload model — pure functions, no Firebase deps ──────────────────
//
// Replaces the arbitrary power^4-weighted TSS with the kilojoule (real
// mechanical work: watts × seconds) as the unit of external training load,
// aggregated into a rolling weekly budget rather than a rigid long-term plan.

import { bestAverageWatts, type PowerFieldsLike } from '@/lib/intervals-api'

export type GovernorStatus = 'vert' | 'orange' | 'rouge' | 'insufficient_data'

export interface KJActivityLike extends PowerFieldsLike {
  start_date_local?: string
  moving_time?: number
}

/** kJ of mechanical work for one session, or null when no power data was recorded. */
export function sessionKJ(activity: KJActivityLike): number | null {
  const watts = bestAverageWatts(activity)
  if (!watts || !activity.moving_time || activity.moving_time <= 0) return null
  return (watts * activity.moving_time) / 1000
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday (yyyy-MM-dd, local time) of the week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 6) % 7 // days since Monday
  d.setDate(d.getDate() - diff)
  return isoDate(d)
}

export interface WeeklyKJBucket {
  weekStart: string // Monday, yyyy-MM-dd
  kJ: number
  sessionsWithPower: number
  sessionsTotal: number
}

/** Aggregates activities into one bucket per ISO week (Monday start), oldest first. */
export function bucketWeeklyKJ(activities: KJActivityLike[]): WeeklyKJBucket[] {
  const map = new Map<string, WeeklyKJBucket>()
  for (const a of activities) {
    if (!a.start_date_local) continue
    const week = mondayOf(a.start_date_local)
    const bucket = map.get(week) ?? { weekStart: week, kJ: 0, sessionsWithPower: 0, sessionsTotal: 0 }
    bucket.sessionsTotal += 1
    const kj = sessionKJ(a)
    if (kj != null) {
      bucket.kJ += kj
      bucket.sessionsWithPower += 1
    }
    map.set(week, bucket)
  }
  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Average weekly kJ over the `weeks` most recent *completed* weeks (the current in-progress week is excluded). */
export function baselineKJ(buckets: WeeklyKJBucket[], referenceMonday: string, weeks = 8): number {
  const completed = buckets.filter((b) => b.weekStart < referenceMonday && b.sessionsWithPower > 0)
  const recent = completed.slice(-weeks)
  if (recent.length === 0) return 0
  return Math.round(average(recent.map((b) => b.kJ)))
}

export function currentWeekKJ(buckets: WeeklyKJBucket[], referenceMonday: string): number {
  return Math.round(buckets.find((b) => b.weekStart === referenceMonday)?.kJ ?? 0)
}

export type TrendDirection = 'up' | 'flat' | 'down'
export interface KJTrend {
  direction: TrendDirection
  pctChange: number
}

/** Compares the first vs second half of a rolling window of completed weeks — a slow, honest trend rather than noisy week-to-week swings. */
export function computeKJTrend(buckets: WeeklyKJBucket[], referenceMonday: string, windowWeeks = 8): KJTrend {
  const completed = buckets.filter((b) => b.weekStart < referenceMonday && b.sessionsWithPower > 0).slice(-windowWeeks)
  if (completed.length < 4) return { direction: 'flat', pctChange: 0 }
  const mid = Math.floor(completed.length / 2)
  const firstHalfAvg = average(completed.slice(0, mid).map((b) => b.kJ))
  const secondHalfAvg = average(completed.slice(mid).map((b) => b.kJ))
  if (firstHalfAvg === 0) return { direction: 'flat', pctChange: 0 }
  const pctChange = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
  const direction: TrendDirection = pctChange > 5 ? 'up' : pctChange < -5 ? 'down' : 'flat'
  return { direction, pctChange }
}

/**
 * Suggested target for the current week: the 8-week baseline, nudged by the
 * internal load governor rather than forced onto a rigid progression. This is
 * a suggestion the athlete can ignore — never an automatic prescription.
 */
export function computeTargetKJ(baseline: number, status: GovernorStatus): number {
  if (baseline <= 0) return 0
  if (status === 'vert') return Math.round(baseline * 1.08)
  if (status === 'rouge') return Math.round(baseline * 0.88)
  return Math.round(baseline) // orange or insufficient_data: hold steady
}
