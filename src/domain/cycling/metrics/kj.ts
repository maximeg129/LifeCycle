// ── Budget kJ — kJ/kg, jamais kJ bruts (R09/R10) ───────────────────────────
//
// Remplace l'unité du budget kJ actuellement en production
// (src/components/cycling/load-types.ts, kJ bruts hebdomadaires) —
// contradiction directe documentée dans docs/AUDIT_CYCLING.md §3.2 avec la
// règle kj-budget-unit-is-kj-per-kg-weighted (R09/R10) ET avec l'affirmation
// interdite "qu'un budget kJ non pondéré reflète la fatigue accumulée"
// (section 8). Ce fichier ne touche pas encore l'UI existante (KJBudgetWidget
// reste sur load-types.ts jusqu'à la Phase 5/UI) — c'est le remplacement
// futur, pas encore branché, même posture que durability.ts en PR 3.
//
// ⚠️ Portée volontairement limitée à ce qui est sourcé. La règle
// kj-budget-increasing-coefficient-above-cp (R10) demande un "coefficient
// croissant par zone" pour le travail réalisé au-dessus de la puissance
// critique — mais ni R09 ni R10 ne donnent de coefficient numérique ni de
// formule exacte (les deux établissent le principe qualitatif : l'intensité
// compte plus que le kJ total, jamais une pondération chiffrée), et la
// puissance critique (CP) de l'athlète elle-même n'est pas encore calculée
// dans l'app (criticalPower.ts, R14/R15, prévu PR 6). Documenté en **Q6**
// (docs/OPEN_QUESTIONS.md) plutôt que tranché par une valeur inventée ici —
// ce module expose donc le budget en kJ/kg (déjà une vraie amélioration sur
// l'unité) et la vérification contre les paliers de durabilité déjà sourcés
// (KJ_DURABILITY_THRESHOLDS), mais PAS encore de pondération par intensité.

import { KJ_DURABILITY_THRESHOLDS, KJ_TARGET_NUDGE, requireConstant } from '../evidence/constants'
import { bestAverageWatts, type PowerFieldsLike } from '@/lib/intervals-api'

export interface KJActivityLike extends PowerFieldsLike {
  start_date_local?: string
  moving_time?: number
}

/**
 * kJ/kg de travail mécanique pour une séance — `null` sans puissance
 * moyenne connue, sans durée, ou sans poids athlète connu (jamais de kJ
 * bruts renvoyés comme repli silencieux : voir kj-budget-unit-is-kj-per-
 * kg-weighted).
 */
export function sessionKJPerKg(activity: KJActivityLike, athleteWeightKg: number | null | undefined): number | null {
  if (!athleteWeightKg || athleteWeightKg <= 0) return null
  const watts = bestAverageWatts(activity)
  if (!watts || !activity.moving_time || activity.moving_time <= 0) return null
  return (watts * activity.moving_time) / 1000 / athleteWeightKg
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Lundi (yyyy-MM-dd, heure locale) de la semaine contenant `dateStr`.
 * Dupliqué volontairement depuis load-types.ts plutôt qu'importé — le
 * domaine (src/domain/cycling) ne dépend d'aucun fichier sous
 * src/components, pour rester indépendant de la couche UI (voir les
 * autres modules metrics/*.ts, aucun n'importe depuis components/).
 */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 6) % 7 // jours depuis lundi
  d.setDate(d.getDate() - diff)
  return isoDate(d)
}

export interface WeeklyKJPerKgBucket {
  weekStart: string // lundi, yyyy-MM-dd
  kJPerKg: number
  sessionsWithData: number
  sessionsTotal: number
}

/** Agrège les activités en un bucket par semaine ISO (début lundi), du plus ancien au plus récent. */
export function bucketWeeklyKJPerKg(activities: KJActivityLike[], athleteWeightKg: number | null | undefined): WeeklyKJPerKgBucket[] {
  const map = new Map<string, WeeklyKJPerKgBucket>()
  for (const a of activities) {
    if (!a.start_date_local) continue
    const week = mondayOf(a.start_date_local)
    const bucket = map.get(week) ?? { weekStart: week, kJPerKg: 0, sessionsWithData: 0, sessionsTotal: 0 }
    bucket.sessionsTotal += 1
    const kJPerKg = sessionKJPerKg(a, athleteWeightKg)
    if (kJPerKg != null) {
      bucket.kJPerKg += kJPerKg
      bucket.sessionsWithData += 1
    }
    map.set(week, bucket)
  }
  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Moyenne hebdomadaire (kJ/kg) sur les `weeks` dernières semaines *complètes* (la semaine en cours est exclue). */
export function baselineKJPerKg(buckets: WeeklyKJPerKgBucket[], referenceMonday: string, weeks = 8): number {
  const completed = buckets.filter((b) => b.weekStart < referenceMonday && b.sessionsWithData > 0)
  const recent = completed.slice(-weeks)
  if (recent.length === 0) return 0
  return average(recent.map((b) => b.kJPerKg))
}

export function currentWeekKJPerKg(buckets: WeeklyKJPerKgBucket[], referenceMonday: string): number {
  return buckets.find((b) => b.weekStart === referenceMonday)?.kJPerKg ?? 0
}

export type KJTrendDirection = 'up' | 'flat' | 'down'
export interface KJPerKgTrend {
  direction: KJTrendDirection
  pctChange: number
}

/** Compare la première vs seconde moitié d'une fenêtre glissante de semaines complètes — une tendance lente et honnête plutôt que le bruit semaine à semaine. */
export function computeKJPerKgTrend(buckets: WeeklyKJPerKgBucket[], referenceMonday: string, windowWeeks = 8): KJPerKgTrend {
  const completed = buckets.filter((b) => b.weekStart < referenceMonday && b.sessionsWithData > 0).slice(-windowWeeks)
  if (completed.length < 4) return { direction: 'flat', pctChange: 0 }
  const mid = Math.floor(completed.length / 2)
  const firstHalfAvg = average(completed.slice(0, mid).map((b) => b.kJPerKg))
  const secondHalfAvg = average(completed.slice(mid).map((b) => b.kJPerKg))
  if (firstHalfAvg === 0) return { direction: 'flat', pctChange: 0 }
  const pctChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
  const direction: KJTrendDirection = pctChange > 5 ? 'up' : pctChange < -5 ? 'down' : 'flat'
  return { direction, pctChange: Math.round(pctChange) }
}

/** Miroir de GovernorStatus (src/components/cycling/load-types.ts) — dupliqué pour la même raison que mondayOf ci-dessus (le domaine ne dépend pas de components/). */
export type GovernorStatusLike = 'vert' | 'orange' | 'rouge' | 'insufficient_data'

/**
 * Cible suggérée pour la semaine en cours : la baseline 8 semaines,
 * ajustée par le gouverneur de charge interne plutôt que forcée sur une
 * progression rigide. Une suggestion que l'athlète peut ignorer — jamais
 * une prescription automatique. Le nudge (+8%/-12%/plateau) vient de
 * KJ_TARGET_NUDGE (evidence/constants.ts, convention — voir le
 * commentaire d'en-tête de ce fichier), pas d'un Rxx.
 */
export function computeTargetKJPerKg(baseline: number, status: GovernorStatusLike): number {
  if (baseline <= 0) return 0
  const nudge = requireConstant(KJ_TARGET_NUDGE, 'KJ_TARGET_NUDGE')
  if (status === 'vert') return baseline * (1 + nudge.greenPct / 100)
  if (status === 'rouge') return baseline * (1 + nudge.redPct / 100)
  return baseline // orange ou insufficient_data : plateau
}

export interface KJDurabilityCeilingCheck {
  kJPerKg: number
  /**
   * Palier de référence (kJ/kg) déjà sourcé (KJ_DURABILITY_THRESHOLDS) le
   * plus élevé que `kJPerKg` atteint ou dépasse — `null` sous le premier
   * seuil. Ce sont des plafonds de référence, JAMAIS des cibles (voir
   * kj-budget-thresholds-are-ceilings-not-targets) — ce champ ne doit
   * jamais être présenté comme un objectif à atteindre.
   */
  exceedsThresholdKJPerKg: number | null
}

/**
 * Situe un total kJ/kg (séance ou semaine) par rapport aux paliers de
 * durabilité déjà sourcés (R08/R10/R11) — une lecture d'exposition, jamais
 * une notation de performance ni une cible à atteindre.
 */
export function checkAgainstDurabilityCeilings(kJPerKg: number): KJDurabilityCeilingCheck {
  const t = requireConstant(KJ_DURABILITY_THRESHOLDS, 'KJ_DURABILITY_THRESHOLDS')
  const orderedThresholds = [
    t.firstMeasurableDeclineKJPerKg,
    t.womenDivergenceStartKJPerKg,
    t.womenDivergenceAmplifiesKJPerKg,
    t.proDegradationKJPerKg,
  ]
  let exceedsThresholdKJPerKg: number | null = null
  for (const threshold of orderedThresholds) {
    if (kJPerKg >= threshold) exceedsThresholdKJPerKg = threshold
  }
  return { kJPerKg, exceedsThresholdKJPerKg }
}
