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

const READINESS_GOOD = '#22c55e' // green-500
const READINESS_OK = '#f97316' // orange-500
const READINESS_LOW = 'hsl(var(--destructive))'
/**
 * Sleep's ring color is fixed rather than graded by value — the fill
 * percentage already carries the "how good" signal (see sleepRingPercent),
 * so the color's job here is just to visually distinguish the sleep ring
 * from the other two, not to double as a second severity indicator.
 */
export const SLEEP_RING_COLOR = '#3b82f6' // blue-500

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
 * connected sensor, or manually entered) — used directly as the ring
 * fill. Without a quality reading, falls back to hours against a generous
 * 9h reference (a full night, not a strict minimum target) so the ring
 * still shows something meaningful rather than sitting empty whenever
 * only hours were logged.
 */
export function sleepRingPercent(sleepHours: number | null | undefined, sleepQuality: number | null | undefined): number {
  if (sleepQuality != null) return Math.max(0, Math.min(100, sleepQuality))
  if (sleepHours != null) return Math.max(0, Math.min(100, (sleepHours / 9) * 100))
  return 0
}
