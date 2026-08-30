// ── Fueling vs Workload — pure functions, no Firebase deps ────────────────
//
// Links the nutrition log to the day's training load: energy burned (from
// real mechanical work when power data exists) vs. energy eaten, plus a
// protein target range scaled to bodyweight.

import { bestAverageWatts, type PowerFieldsLike } from '@/lib/intervals-api'

export interface FuelingActivityLike extends PowerFieldsLike {
  moving_time?: number
  icu_intensity?: number | null
}

/** Rough MET for cycling when no power data is available, bucketed by Intervals.icu intensity. */
function estimateMET(intensity?: number | null): number {
  if (intensity == null) return 8 // generic moderate-cycling fallback
  if (intensity < 50) return 4
  if (intensity < 75) return 8
  if (intensity < 100) return 10
  return 12
}

/**
 * kcal burned for one session. When power data exists, uses the standard
 * cycling rule of thumb kJ (mechanical work) ≈ kcal — gross efficiency
 * (~23%) and the kJ-per-kcal conversion (4.184) very nearly cancel out.
 * Otherwise falls back to a duration × MET × bodyweight estimate, which
 * needs a known bodyweight.
 */
export function sessionEnergyBurnedKcal(activity: FuelingActivityLike, weightKg?: number | null): number | null {
  const watts = bestAverageWatts(activity)
  if (watts && activity.moving_time) {
    const kJ = (watts * activity.moving_time) / 1000
    return Math.round(kJ)
  }
  if (activity.moving_time && weightKg) {
    const hours = activity.moving_time / 3600
    return Math.round(hours * estimateMET(activity.icu_intensity) * weightKg)
  }
  return null
}

export function totalEnergyBurnedKcal(activities: FuelingActivityLike[], weightKg?: number | null): number {
  return activities.reduce((sum, a) => sum + (sessionEnergyBurnedKcal(a, weightKg) ?? 0), 0)
}

export function recoveryGap(eatenKcal: number, burnedKcal: number): number {
  return eatenKcal - burnedKcal
}

export interface ProteinTargetRange {
  min: number
  max: number
}

/** 1.6-2.0 g/kg — a range, not a single number, since the right target depends on the day's load. */
export function proteinTargetRange(weightKg: number): ProteinTargetRange {
  return { min: Math.round(weightKg * 1.6), max: Math.round(weightKg * 2.0) }
}

// ── Basal metabolic rate — retour utilisateur : "d'une façon différenciée
// ajouter le métabolisme de base et séparer les calories brûlées au sport"
// (see fueling-widget.tsx: "Sport" and "Métabolisme" are now two distinct
// stats, never folded into one "Brûlé" number). ─────────────────────────

export type Sex = 'male' | 'female'

export interface BiometricsLike {
  heightCm?: number | null
  age?: number | null
  sex?: Sex | null
}

/**
 * Mifflin-St Jeor — the current standard resting-metabolic-rate estimate
 * (more accurate than the older Harris-Benedict formula it replaced in most
 * clinical/sports-nutrition use). A whole-day estimate (BMR is what the
 * body burns at complete rest over 24h) — never prorated to the time of day,
 * unlike "Sport" which only reflects activities actually logged so far.
 * Needs weight (kg, from Intervals.icu), height (cm), age (years) and sex —
 * null if any is missing, never a guessed default for a biometric this
 * personal.
 */
export function computeBMR(weightKg: number | null | undefined, biometrics: BiometricsLike | null | undefined): number | null {
  if (!weightKg || weightKg <= 0) return null
  const heightCm = biometrics?.heightCm
  const age = biometrics?.age
  const sex = biometrics?.sex
  if (!heightCm || heightCm <= 0 || !age || age <= 0 || !sex) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}
