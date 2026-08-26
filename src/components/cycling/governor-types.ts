// ── Internal load governor — pure functions, no Firebase deps ─────────────
//
// Aggregates RHR, HR-at-effort drift, HRV, RPE, and feelings/motivation into
// a simple green/orange/red status that nudges the weekly kJ budget up or
// down — a soft governor the athlete stays in control of, rather than a
// rigid 16-week plan.

import type { GovernorStatus } from './load-types'

/** +1 favorable, 0 neutral, -1 unfavorable, null = not enough data to say. */
export type Signal = 1 | 0 | -1 | null

export function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export interface DatedValue {
  date: string // yyyy-MM-dd
  value: number
}

/** Splits a dated series into a recent window and the baseline window immediately preceding it. */
export function splitRecentBaseline(series: DatedValue[], referenceIso: string, recentDays = 7, baselineDays = 21): { recent: number[]; baseline: number[] } {
  const recentCutoff = shiftIso(referenceIso, -recentDays)
  const baselineCutoff = shiftIso(referenceIso, -(recentDays + baselineDays))
  const recent = series.filter((s) => s.date >= recentCutoff && s.date <= referenceIso).map((s) => s.value)
  const baseline = series.filter((s) => s.date >= baselineCutoff && s.date < recentCutoff).map((s) => s.value)
  return { recent, baseline }
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Compares a recent-window average to its preceding baseline. `favorableDirection`
 * says which way is good (e.g. 'lower' for resting HR, 'higher' for HRV).
 * Requires at least 2 points in each window, else returns null (honest — no signal).
 */
export function windowedTrendSignal(series: DatedValue[], referenceIso: string, favorableDirection: 'lower' | 'higher', opts?: { recentDays?: number; baselineDays?: number; thresholdPct?: number }): Signal {
  const { recent, baseline } = splitRecentBaseline(series, referenceIso, opts?.recentDays ?? 7, opts?.baselineDays ?? 21)
  if (recent.length < 2 || baseline.length < 2) return null
  const recentAvg = averageOrNull(recent)
  const baselineAvg = averageOrNull(baseline)
  if (recentAvg == null || baselineAvg == null || baselineAvg === 0) return null

  const pctChange = ((recentAvg - baselineAvg) / baselineAvg) * 100
  const favorableChange = favorableDirection === 'lower' ? -pctChange : pctChange
  const threshold = opts?.thresholdPct ?? 3
  if (favorableChange > threshold) return 1
  if (favorableChange < -threshold) return -1
  return 0
}

/** Efficiency factor (watts/bpm) for one low-intensity session — higher is better (more power for the same heart rate). */
export function efficiencyFactor(avgWatts: number | null | undefined, avgHeartrate: number | null | undefined): number | null {
  if (!avgWatts || !avgHeartrate || avgHeartrate <= 0) return null
  return avgWatts / avgHeartrate
}

/** Averages recent 'bien'/'neutre'/'mauvais' feelings (already mapped to +1/0/-1) into a signal. */
export function feelingsSignal(scores: DatedValue[], referenceIso: string, recentDays = 7): Signal {
  const cutoff = shiftIso(referenceIso, -recentDays)
  const recent = scores.filter((s) => s.date >= cutoff && s.date <= referenceIso).map((s) => s.value)
  if (recent.length === 0) return null
  const avg = averageOrNull(recent)
  if (avg == null) return null
  if (avg > 0.25) return 1
  if (avg < -0.25) return -1
  return 0
}

export interface GovernorSignals {
  restingHR: Signal
  hrvTrend: Signal
  effortHrDrift: Signal
  rpe: Signal
  feelings: Signal
  /** Trend of the Vie & Santé readiness score (sommeil/stress/humeur) — cross-references recovery tracking with training load rather than treating them as separate worlds. */
  sleepRecovery: Signal
}

/** Aggregates the available signals into a single status. Needs at least 2 non-null signals to call it — otherwise it's honestly "insufficient_data", not a guess. */
export function computeInternalLoadStatus(signals: GovernorSignals): GovernorStatus {
  const values = Object.values(signals).filter((s): s is 1 | 0 | -1 => s !== null)
  if (values.length < 2) return 'insufficient_data'
  const sum = values.reduce((a: number, b) => a + b, 0)
  if (sum > 0) return 'vert'
  if (sum < 0) return 'rouge'
  return 'orange'
}
