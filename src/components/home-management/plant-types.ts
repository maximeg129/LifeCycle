// ── Plant care — pure helpers ───────────────────────────────────────
//
// Extracted from the old standalone Botanica page (now the "Plantes" tab
// of Maison — see AUDIT.md/PLAN.md for why the two modules were merged).
// Kept pure and Firestore-agnostic so watering/health logic is testable
// without mocking Firestore, matching the convention used elsewhere in
// the app (cycling, nutrition, lifestyle).

import { addDays, differenceInDays } from 'date-fns'

export interface PlantLike {
  lastWateringDate?: { seconds: number } | null
  wateringFrequencyDays?: number
}

export interface AnalysisDateLike {
  lastAnalysisDate?: { seconds: number } | null
}

const ANALYSIS_FREQUENCY_DAYS = 30

/**
 * Days until next watering is due — negative means overdue.
 * `now` defaults to the real current time; pass it explicitly in tests to
 * avoid depending on the system clock.
 */
export function getDaysUntilWatering(plant: PlantLike, now: Date = new Date()): number {
  if (!plant.lastWateringDate?.seconds) return -(plant.wateringFrequencyDays || 7)
  const lastWatered = new Date(plant.lastWateringDate.seconds * 1000)
  const nextWatering = addDays(lastWatered, plant.wateringFrequencyDays || 7)
  return differenceInDays(nextWatering, now)
}

export function getHealthColor(score: number): string {
  if (score >= 75) return 'text-green-500'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-500'
}

export function getHealthLabel(score: number): string {
  if (score >= 75) return 'Saine'
  if (score >= 50) return 'Surveiller'
  return 'Critique'
}

export function getHealthStatus(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 75) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

/**
 * True if the plant has never been AI-analyzed, or its last analysis is
 * stale. `now` defaults to the real current time; pass it explicitly in
 * tests to avoid depending on the system clock.
 */
export function isAnalysisOverdue(plant: AnalysisDateLike, now: Date = new Date()): boolean {
  if (!plant.lastAnalysisDate?.seconds) return true
  const lastAnalysis = new Date(plant.lastAnalysisDate.seconds * 1000)
  return differenceInDays(now, lastAnalysis) >= ANALYSIS_FREQUENCY_DAYS
}
