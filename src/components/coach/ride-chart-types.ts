// ── Graphique Puissance & FC (Activité détail) — données pures ──────────
//
// Restructuration lifecycle-ui-reference.html (voir CLAUDE.md, "Refonte
// UI/IA — Work Package D", étape 5 : "le graphique puissance/FC avec
// intervalles cibles ombrés... différé à une pièce dédiée"). Les flux
// watts/heartrate bruts (seconde par seconde) sont déjà fetchés par
// use-ride-analysis.ts pour réduire durabilité/découplage/pacing — mais
// jamais exposés tels quels (trop volumineux pour Firestore/le prompt IA,
// et non nécessaires au-delà de ce module). Ce fichier réduit ces mêmes
// flux en une série downsamplée persistable (RideChartSeries), calculée
// UNE SEULE FOIS à la génération et écrasée à la régénération — même
// patron "null jamais undefined, recalculer exigerait de refetcher les
// streams" déjà en place pour durability/decoupling/intervalAdherence.
//
// Jamais interpolé : un point sans donnée réelle dans son intervalle de
// downsampling reste `null`, jamais une valeur devinée entre deux voisins.

import { average } from './ride-analysis-types'
import type { IntervalAdherenceStep, IntervalAdherenceVerdict } from './interval-adherence-types'

export const RIDE_CHART_MAX_POINTS = 120

export interface RideChartPoint {
  /** Secondes depuis le départ de la sortie — position x sur le graphique. */
  t: number
  /** Moyenne watts de l'intervalle de downsampling, `null` si aucune donnée réelle dans cet intervalle. */
  watts: number | null
  /** Moyenne FC de l'intervalle de downsampling, `null` si aucune donnée réelle dans cet intervalle. */
  hr: number | null
}

export interface RideChartSeries {
  /** Durée totale de la série source (longueur du flux le plus long) — jamais `activity.moving_time`, qui peut légèrement diverger du flux réel (pauses...). */
  totalSeconds: number
  points: RideChartPoint[]
}

/**
 * Réduit les flux watts/heartrate (un point par seconde, potentiellement
 * des milliers de points) à au plus `maxPoints` points moyennés par
 * intervalle — assez pour tracer une ligne lisible dans un encart de
 * dialogue, sans jamais stocker le flux complet. `null` si ni l'un ni
 * l'autre flux n'a de données (rien à tracer).
 */
export function downsampleRideSeries(
  watts: number[] | null | undefined,
  heartrate: number[] | null | undefined,
  maxPoints: number = RIDE_CHART_MAX_POINTS
): RideChartSeries | null {
  const length = Math.max(watts?.length ?? 0, heartrate?.length ?? 0)
  if (length === 0) return null

  const pointCount = Math.min(maxPoints, length)
  const bucketSize = length / pointCount
  const points: RideChartPoint[] = []

  for (let i = 0; i < pointCount; i++) {
    const start = Math.floor(i * bucketSize)
    const end = i === pointCount - 1 ? length : Math.max(start + 1, Math.floor((i + 1) * bucketSize))
    const wattsBucket = watts?.slice(start, end)
    const hrBucket = heartrate?.slice(start, end)
    const wattsAvg = wattsBucket && wattsBucket.length > 0 ? average(wattsBucket) : null
    const hrAvg = hrBucket && hrBucket.length > 0 ? average(hrBucket) : null
    points.push({
      t: start,
      watts: wattsAvg != null ? Math.round(wattsAvg) : null,
      hr: hrAvg != null ? Math.round(hrAvg) : null,
    })
  }

  return { totalSeconds: length, points }
}

/** Min/max réels d'une série (ignorant les `null`) — `null` si aucune valeur, jamais une plage inventée (0-0 ferait croire à une ligne plate). */
export function chartSeriesRange(points: RideChartPoint[], accessor: (p: RideChartPoint) => number | null): { min: number; max: number } | null {
  const values = points.map(accessor).filter((v): v is number => v != null)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * Convertit la série de points en segments de polyligne SVG (x/y en
 * coordonnées de viewBox) — plusieurs segments plutôt qu'un seul chemin
 * continu dès qu'un trou de données existe (jamais une ligne qui
 * interpolerait entre deux points réels séparés par une absence).
 */
export function buildChartLineSegments(
  points: RideChartPoint[],
  accessor: (p: RideChartPoint) => number | null,
  totalSeconds: number,
  min: number,
  max: number,
  width: number,
  height: number,
  paddingY: number
): { x: number; y: number }[][] {
  if (totalSeconds <= 0) return []
  const range = max - min
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (const p of points) {
    const value = accessor(p)
    if (value == null) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
      continue
    }
    const x = (p.t / totalSeconds) * width
    const y = range > 0
      ? paddingY + (1 - (value - min) / range) * (height - 2 * paddingY)
      : height / 2
    current.push({ x, y })
  }
  if (current.length > 0) segments.push(current)
  return segments
}

export interface IntervalTargetWindow {
  startSeconds: number
  endSeconds: number
  pctLow: number
  pctHigh: number
  verdict: IntervalAdherenceVerdict
}

/**
 * Reconstruit l'offset cumulé de chaque étape prévue — IntervalAdherenceStep
 * ne porte que sa propre durée (targetDurationSeconds), jamais son offset
 * de départ (interval-adherence-types.ts ne l'expose pas, l'ayant seulement
 * en variable locale `cursor` pour découper `watts`). Même cumul, recalculé
 * ici pour positionner les bandes ombrées du graphique sur son propre axe
 * temporel — jamais une deuxième logique de découpage du flux réel.
 */
export function buildIntervalTargetWindows(steps: IntervalAdherenceStep[]): IntervalTargetWindow[] {
  let cursor = 0
  return steps.map((step) => {
    const startSeconds = cursor
    cursor += step.targetDurationSeconds
    return { startSeconds, endSeconds: cursor, pctLow: step.targetPctLow, pctHigh: step.targetPctHigh, verdict: step.verdict }
  })
}
