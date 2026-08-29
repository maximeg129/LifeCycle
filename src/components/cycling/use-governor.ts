"use client"

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useWellness, useActivities } from '@/hooks/use-intervals'
import { bestAverageWatts } from '@/lib/intervals-api'
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
  resolveReadiness,
  type HealthMetric,
  type WellnessLike,
} from '@/components/lifestyle/lifestyle-types'
import type { GovernorStatus } from './load-types'

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest = format(subDays(today, 35), 'yyyy-MM-dd') // 7d recent + 21d baseline + buffer
const oldestDate = subDays(today, 35)
oldestDate.setHours(0, 0, 0, 0)
// Same 36-day span (today + 35 days back) as the wellness/healthMetrics
// queries above, as day-ids for buildMergedDailySeries below.
const sleepDayIds = getLastDayIds(36, today)

// Rides below this Intervals.icu intensity are treated as low-intensity/endurance,
// where HR drift at a stable effort is a meaningful recovery signal.
const LOW_INTENSITY_THRESHOLD = 75

export interface GovernorResult {
  status: GovernorStatus
  signals: GovernorSignals
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

    const rpeSeries: DatedValue[] = feedback
      .filter((f) => f.rpe != null)
      .map((f) => ({ date: f.date, value: f.rpe as number }))

    const feelingSeries: DatedValue[] = feedback
      .map((f) => ({ date: f.date, value: feelingScore(f.feeling, f.motivation) }))
      .filter((x): x is { date: string; value: number } => x.value != null)

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
    const sleepSeries: DatedValue[] = mergedDaily
      .map((day) => {
        const readiness = resolveReadiness(day, wellnessByDay.get(day.dayId)?.readiness)
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

    return {
      status: computeInternalLoadStatus(signals),
      signals,
      isLoading: wellness.isLoading || activities.isLoading || loadingFeedback || loadingHealthMetrics,
    }
  }, [wellness.data, wellness.isLoading, activities.data, activities.isLoading, feedback, loadingFeedback, healthMetrics, loadingHealthMetrics])
}
