"use client"

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useActivities } from '@/hooks/use-intervals'
import type { GovernorStatus } from './load-types'
import {
  bucketWeeklyKJPerKg,
  baselineKJPerKg,
  currentWeekKJPerKg,
  computeKJPerKgTrend,
  computeTargetKJPerKg,
  checkAgainstDurabilityCeilings,
  mondayOf,
  type KJTrendDirection,
} from '@/domain/cycling/metrics/kj'

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
// 8 baseline weeks + current week + a couple of buffer weeks for the trend window.
const kjOldest = format(subDays(today, 77), 'yyyy-MM-dd')

export interface KJBudgetSummary {
  /** kJ/kg — jamais des kJ bruts (règle kj-budget-unit-is-kj-per-kg-weighted, R09/R10). Voir domain/cycling/metrics/kj.ts. */
  realized: number
  baseline: number
  target: number
  trend: { direction: KJTrendDirection; pctChange: number }
  /** Palier de durabilité déjà sourcé (R08/R10/R11) le plus élevé dépassé cette semaine — plafond de référence, jamais une cible (voir kj-budget-thresholds-are-ceilings-not-targets). `null` sous le premier seuil. */
  exceedsThresholdKJPerKg: number | null
  /** False when no session in the window has power data, or the athlete's weight isn't known — le budget kJ/kg ne peut pas être calculé honnêtement sans poids. */
  isAvailable: boolean
  isLoading: boolean
}

/**
 * Shared kJ/kg-budget computation — one Intervals.icu activities fetch,
 * reused by the dashboard widget and the Coach Memory badge. Remplace
 * l'ancien budget en kJ bruts (load-types.ts, en production jusqu'ici —
 * voir docs/AUDIT_CYCLING.md §3.2, contradiction directe avec la
 * spécification) : passe maintenant par domain/cycling/metrics/kj.ts,
 * livré en PR 4, jamais branché avant cette PR. `athleteWeightKg` : requis
 * pour convertir en kJ/kg — `null` si inconnu (isAvailable devient false,
 * jamais un repli silencieux sur des kJ bruts).
 */
export function useKJBudget(governorStatus: GovernorStatus, athleteWeightKg: number | null | undefined): KJBudgetSummary {
  const activities = useActivities(kjOldest, newest)

  return useMemo(() => {
    const buckets = bucketWeeklyKJPerKg(activities.data, athleteWeightKg)
    const referenceMonday = mondayOf(newest)
    const realized = currentWeekKJPerKg(buckets, referenceMonday)
    const baseline = baselineKJPerKg(buckets, referenceMonday, 8)
    const target = computeTargetKJPerKg(baseline, governorStatus)
    const trend = computeKJPerKgTrend(buckets, referenceMonday, 8)
    const { exceedsThresholdKJPerKg } = checkAgainstDurabilityCeilings(realized)
    const isAvailable = !!athleteWeightKg && buckets.some((b) => b.sessionsWithData > 0)
    return { realized, baseline, target, trend, exceedsThresholdKJPerKg, isAvailable, isLoading: activities.isLoading }
  }, [activities.data, activities.isLoading, governorStatus, athleteWeightKg])
}
