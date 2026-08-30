// ── Pure percent/color mapping for the "état de forme" ring row ────────
//
// Forme (TSB) / Récupération (Readiness) / Sommeil rings on Cyclisme >
// Vue d'ensemble — user feedback, a screenshot of Whoop's own 3-ring
// layout: "forme tsb - readiness - sommeil (heure et qualité), peux ton
// avoir... représenté de cette façon ?". Kept separate from ring-gauge.tsx
// (SVG rendering) so the math is unit-testable without mounting a
// component — and colors here are real CSS values, not Tailwind classes:
// an SVG <circle> paints via the `stroke` attribute, not the CSS
// `background-color` property a `bg-*` utility sets (same lesson as
// tsb-zones.ts's fillColor, learned the hard way on the TSB chart bands).

import { tsbZone } from './tsb-zones'
import { sleepQualityBand } from '@/components/lifestyle/lifestyle-types'

const READINESS_GOOD = '#22c55e' // green-500
const READINESS_OK = '#f97316' // orange-500
const READINESS_LOW = 'hsl(var(--destructive))'
const SLEEP_GOOD = '#22c55e' // green-500 — Great/Good (score ≥80)
const SLEEP_AVERAGE = '#f97316' // orange-500 — Average (60-79)
const SLEEP_POOR = 'hsl(var(--destructive))' // Poor (<60)
/** No quality reading at all yet (only hours, or nothing) — same neutral fallback color the other two rings use. */
const SLEEP_UNKNOWN = '#3b82f6' // blue-500

/**
 * TSB doesn't live on a natural 0-100 scale — clamped to a practical
 * [-30, 20] window (the Optimal zone's floor to the Fresh zone's ceiling,
 * see tsb-zones.ts) and normalized, so the ring reads full/empty at
 * realistic extremes instead of needing an unbounded scale.
 */
export function tsbRingPercent(tsb: number): number {
  const clamped = Math.max(-30, Math.min(20, tsb))
  return ((clamped + 30) / 50) * 100
}

/** Reuses the exact same 5-zone color as the TSB tile/chart elsewhere — one classification, not a second one for the ring. */
export function tsbRingColor(tsb: number): string {
  return tsbZone(tsb).fillColor
}

/** Same thresholds as the existing Readiness tile's sublabel (>75 "Prêt pour l'effort", >50 "Effort modéré", else "Récupération"). */
export function readinessRingColor(readiness: number): string {
  if (readiness > 75) return READINESS_GOOD
  if (readiness > 50) return READINESS_OK
  return READINESS_LOW
}

/**
 * Sleep quality is already a 0-100 score when known (auto-synced from a
 * connected sensor, or manually entered — see mergeDailyWellness in
 * lifestyle-types.ts for why this is sleepScore, never Intervals.icu's
 * raw 1-4 sleepQuality band) — used directly as the ring fill. Without a
 * quality reading, falls back to hours against a generous 9h reference (a
 * full night, not a strict minimum target) so the ring still shows
 * something meaningful rather than sitting empty whenever only hours were
 * logged.
 */
export function sleepRingPercent(sleepHours: number | null | undefined, sleepQuality: number | null | undefined): number {
  if (sleepQuality != null) return Math.max(0, Math.min(100, sleepQuality))
  if (sleepHours != null) return Math.max(0, Math.min(100, (sleepHours / 9) * 100))
  return 0
}

/**
 * Grades the sleep ring's color by Intervals.icu's own Great/Good/
 * Average/Poor bands (sleepQualityBand in lifestyle-types.ts) — user
 * feedback: "q1 c'est great, q2=good, q3=average, q4=poor on peut
 * utiliser ça pour la couleur". Great and Good collapse into one green
 * tier (matching the 3-color green/orange/red severity scheme the other
 * rings already use) rather than 4 distinct colors. Falls back to a
 * neutral color when there's no quality reading at all (only hours, or
 * nothing) — sleepRingPercent() still shows the hours-based fill in that
 * case, just without a graded color for it.
 */
export function sleepRingColor(sleepQuality: number | null | undefined): string {
  if (sleepQuality == null) return SLEEP_UNKNOWN
  const band = sleepQualityBand(sleepQuality)
  if (band === 'poor') return SLEEP_POOR
  if (band === 'average') return SLEEP_AVERAGE
  return SLEEP_GOOD
}
