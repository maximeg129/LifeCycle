"use client"

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useWellness, useActivities } from '@/hooks/use-intervals'
import { bestAverageWatts, bestRpe, feelToScore } from '@/lib/intervals-api'
import { useSessionFeedback } from './use-session-feedback'
import {
  windowedTrendSignal,
  efficiencyFactor,
  feelingsSignal,
  computeInternalLoadStatus,
  type GovernorSignals,
  type DatedValue,
} from './governor-types'
import { feelingScore } from './session-feedback-types'
import {
  getLastDayIds,
  buildMergedDailySeries,
  computeReadiness,
  type HealthMetric,
  type WellnessLike,
} from '@/components/lifestyle/lifestyle-types'
import type { GovernorStatus } from './load-types'
import { computeSessionRPE, computeMonotony, computeStrain } from '@/domain/cycling/metrics/load'

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest = format(subDays(today, 35), 'yyyy-MM-dd') // 7d recent + 21d baseline + buffer
const oldestDate = subDays(today, 35)
oldestDate.setHours(0, 0, 0, 0)
// Same 36-day span (today + 35 days back) as the wellness/healthMetrics
// queries above, as day-ids for buildMergedDailySeries below.
const sleepDayIds = getLastDayIds(36, today)
// 7 jours glissants pour la charge d'entraînement (session-RPE/monotonie/
// strain, R21) — la fenêtre que Foster (1998/2001) utilise pour ces deux
// métriques, distincte des fenêtres 7j/21j des 6 signaux du gouverneur.
const last7DayIds = getLastDayIds(7, today)

// Rides below this Intervals.icu intensity are treated as low-intensity/endurance,
// where HR drift at a stable effort is a meaningful recovery signal.
const LOW_INTENSITY_THRESHOLD = 75

export interface TrainingLoadSummary {
  /** Somme des session-RPE (RPE × durée) des 7 derniers jours. */
  weeklySessionRPE: number
  /** Moyenne/écart-type de la charge quotidienne sur ces 7 jours — `null` si non calculable (voir computeMonotony). Nombre descriptif, jamais un verdict favorable/défavorable : aucun seuil sourcé ne permet de classer "haute" monotonie (voir docs/OPEN_QUESTIONS.md Q7). */
  monotony: number | null
  /** Charge hebdomadaire × monotonie — `null` si la monotonie ne l'est pas. Même réserve que monotony ci-dessus. */
  strain: number | null
}

export interface GovernorResult {
  status: GovernorStatus
  signals: GovernorSignals
  /** `null` tant qu'aucune activité n'a de RPE ET de durée sur les 7 derniers jours (voir le calcul plus bas — jamais une durée inventée pour un feedback local sans activité liée). */
  trainingLoad: TrainingLoadSummary | null
  isLoading: boolean
}

/** Aggregates RHR, HRV, low-intensity HR drift, RPE, feelings/motivation and the Vie & Santé readiness trend into a single load-governor status. */
export function useGovernor(): GovernorResult {
  const { user } = useUser()
  const db = useFirestore()
  const wellness = useWellness(oldest, newest)
  const activities = useActivities(oldest, newest)
  const { feedback, isLoading: loadingFeedback } = useSessionFeedback()

  const healthMetricsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(
      collection(db, `users/${user.uid}/healthMetrics`),
      where('date', '>=', Timestamp.fromDate(oldestDate)),
      orderBy('date', 'asc')
    )
  }, [db, user])
  const { data: healthMetrics, isLoading: loadingHealthMetrics } = useCollection<HealthMetric>(healthMetricsQuery)

  return useMemo(() => {
    const rhrSeries: DatedValue[] = wellness.data
      .filter((w) => w.restingHR != null)
      .map((w) => ({ date: w.id, value: w.restingHR as number }))

    const hrvSeries: DatedValue[] = wellness.data
      .filter((w) => w.hrv != null)
      .map((w) => ({ date: w.id, value: w.hrv as number }))

    const efSeries: DatedValue[] = activities.data
      .filter((a) => a.icu_intensity != null && a.icu_intensity < LOW_INTENSITY_THRESHOLD && a.start_date_local)
      .map((a) => ({ date: (a.start_date_local as string).slice(0, 10), ef: efficiencyFactor(bestAverageWatts(a), a.average_heartrate) }))
      .filter((x): x is { date: string; ef: number } => x.ef != null)
      .map((x) => ({ date: x.date, value: x.ef }))

    // RPE and "feel" are entered directly on each activity's Intervals.icu
    // page — that's the primary source now, not the app's own quick-feedback
    // widget (used inconsistently). Local sessionFeedback fills in whatever
    // Intervals.icu doesn't have for a given date (not-yet-rated activities,
    // or a standalone daily-* check-in with no linked activity) rather than
    // being dropped, but never doubles up a date Intervals.icu already covers.
    const intervalsRpeSeries: DatedValue[] = activities.data
      .map((a) => {
        const rpe = bestRpe(a)
        if (rpe == null || !a.start_date_local) return null
        return { date: a.start_date_local.slice(0, 10), value: rpe }
      })
      .filter((x): x is DatedValue => x != null)
    const intervalsRpeDates = new Set(intervalsRpeSeries.map((x) => x.date))
    const localRpeSeries: DatedValue[] = feedback
      .filter((f) => f.rpe != null && !intervalsRpeDates.has(f.date))
      .map((f) => ({ date: f.date, value: f.rpe as number }))
    const rpeSeries: DatedValue[] = [...intervalsRpeSeries, ...localRpeSeries]

    const intervalsFeelSeries: DatedValue[] = activities.data
      .map((a) => {
        const score = feelToScore(a)
        if (score == null || !a.start_date_local) return null
        return { date: a.start_date_local.slice(0, 10), value: score }
      })
      .filter((x): x is DatedValue => x != null)
    const intervalsFeelDates = new Set(intervalsFeelSeries.map((x) => x.date))
    const localFeelingSeries: DatedValue[] = feedback
      .filter((f) => !intervalsFeelDates.has(f.date))
      .map((f) => ({ date: f.date, value: feelingScore(f.feeling, f.motivation) }))
      .filter((x): x is { date: string; value: number } => x.value != null)
    const feelingSeries: DatedValue[] = [...intervalsFeelSeries, ...localFeelingSeries]

    // Cross-references the Vie & Santé daily log (sommeil, stress, humeur)
    // with training load instead of treating recovery and cycling as
    // separate worlds — the composite readiness score already used there.
    // Merges manual entries with auto-synced Intervals.icu wellness (same
    // merge as useLifestyleData/mergeDailyWellness) — without this, anyone
    // relying on auto-sync alone (no manual Vie & Santé entries) saw this
    // signal stuck on "N/D" even though Vue d'ensemble showed real sleep/HRV
    // numbers right above, from the exact same underlying data.
    const wellnessByDay = new Map<string, WellnessLike>(wellness.data.map((w) => [w.id, w]))
    const mergedDaily = buildMergedDailySeries(healthMetrics || [], wellnessByDay, sleepDayIds)
    // mergedDaily couvre déjà 36 jours (7 récents + 21+ de marge, voir
    // `oldest` plus haut) — largement assez pour la ligne de base ≥4
    // semaines qu'exige maintenant computeReadiness() pour ses composantes
    // HRV/FC repos (voir lifestyle-types.ts) : aucun fetch supplémentaire
    // nécessaire ici, contrairement à useLifestyleData() qui a dû élargir
    // le sien pour le même besoin.
    const sleepSeries: DatedValue[] = mergedDaily
      .map((day) => {
        const readiness = computeReadiness(day, mergedDaily)
        if (readiness == null) return null
        return { date: day.dayId, value: readiness }
      })
      .filter((x): x is DatedValue => x != null)

    const signals: GovernorSignals = {
      restingHR: windowedTrendSignal(rhrSeries, newest, 'lower'),
      hrvTrend: windowedTrendSignal(hrvSeries, newest, 'higher'),
      effortHrDrift: windowedTrendSignal(efSeries, newest, 'higher'),
      rpe: windowedTrendSignal(rpeSeries, newest, 'lower'),
      feelings: feelingsSignal(feelingSeries, newest),
      sleepRecovery: windowedTrendSignal(sleepSeries, newest, 'higher'),
    }

    // Charge d'entraînement — session-RPE/monotonie/strain (R21, load.ts).
    // Nécessite RPE ET durée sur la MÊME séance : seules les activités
    // Intervals.icu (qui portent moving_time) avec un RPE réel (bestRpe)
    // sont utilisées — un feedback local (sessionFeedback) sans activité
    // liée n'a pas de durée associée, jamais une durée inventée pour
    // combler ce trou (contrairement à rpeSeries plus haut, qui n'a pas
    // besoin de durée et peut donc inclure le feedback local).
    const dailyLoadByDate = new Map<string, number>()
    for (const a of activities.data) {
      const rpe = bestRpe(a)
      const durationMinutes = a.moving_time != null ? a.moving_time / 60 : null
      if (rpe == null || durationMinutes == null || !a.start_date_local) continue
      const date = a.start_date_local.slice(0, 10)
      const sessionRPE = computeSessionRPE(rpe, durationMinutes)
      dailyLoadByDate.set(date, (dailyLoadByDate.get(date) ?? 0) + sessionRPE)
    }
    const dailyLoads = last7DayIds.map((d) => dailyLoadByDate.get(d) ?? 0)
    const hasAnyLoad = dailyLoads.some((v) => v > 0)
    const trainingLoad: TrainingLoadSummary | null = hasAnyLoad
      ? {
          weeklySessionRPE: Math.round(dailyLoads.reduce((sum, v) => sum + v, 0)),
          monotony: computeMonotony(dailyLoads),
          strain: (() => {
            const strain = computeStrain(dailyLoads)
            return strain != null ? Math.round(strain) : null
          })(),
        }
      : null

    return {
      status: computeInternalLoadStatus(signals),
      signals,
      trainingLoad,
      isLoading: wellness.isLoading || activities.isLoading || loadingFeedback || loadingHealthMetrics,
    }
  }, [wellness.data, wellness.isLoading, activities.data, activities.isLoading, feedback, loadingFeedback, healthMetrics, loadingHealthMetrics])
}
