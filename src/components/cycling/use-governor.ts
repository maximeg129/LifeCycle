"use client"

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useWellness, useActivities } from '@/hooks/use-intervals'
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
import type { GovernorStatus } from './load-types'

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest = format(subDays(today, 35), 'yyyy-MM-dd') // 7d recent + 21d baseline + buffer

// Rides below this Intervals.icu intensity are treated as low-intensity/endurance,
// where HR drift at a stable effort is a meaningful recovery signal.
const LOW_INTENSITY_THRESHOLD = 75

export interface GovernorResult {
  status: GovernorStatus
  signals: GovernorSignals
  isLoading: boolean
}

/** Aggregates RHR, HRV, low-intensity HR drift, RPE and feelings/motivation into a single load-governor status. */
export function useGovernor(): GovernorResult {
  const wellness = useWellness(oldest, newest)
  const activities = useActivities(oldest, newest)
  const { feedback, isLoading: loadingFeedback } = useSessionFeedback()

  return useMemo(() => {
    const rhrSeries: DatedValue[] = wellness.data
      .filter((w) => w.restingHR != null)
      .map((w) => ({ date: w.id, value: w.restingHR as number }))

    const hrvSeries: DatedValue[] = wellness.data
      .filter((w) => w.hrv != null)
      .map((w) => ({ date: w.id, value: w.hrv as number }))

    const efSeries: DatedValue[] = activities.data
      .filter((a) => a.icu_intensity != null && a.icu_intensity < LOW_INTENSITY_THRESHOLD && a.start_date_local)
      .map((a) => ({ date: (a.start_date_local as string).slice(0, 10), ef: efficiencyFactor(a.average_watts, a.average_heartrate) }))
      .filter((x): x is { date: string; ef: number } => x.ef != null)
      .map((x) => ({ date: x.date, value: x.ef }))

    const rpeSeries: DatedValue[] = feedback
      .filter((f) => f.rpe != null)
      .map((f) => ({ date: f.date, value: f.rpe as number }))

    const feelingSeries: DatedValue[] = feedback
      .map((f) => ({ date: f.date, value: feelingScore(f.feeling, f.motivation) }))
      .filter((x): x is { date: string; value: number } => x.value != null)

    const signals: GovernorSignals = {
      restingHR: windowedTrendSignal(rhrSeries, newest, 'lower'),
      hrvTrend: windowedTrendSignal(hrvSeries, newest, 'higher'),
      effortHrDrift: windowedTrendSignal(efSeries, newest, 'higher'),
      rpe: windowedTrendSignal(rpeSeries, newest, 'lower'),
      feelings: feelingsSignal(feelingSeries, newest),
    }

    return {
      status: computeInternalLoadStatus(signals),
      signals,
      isLoading: wellness.isLoading || activities.isLoading || loadingFeedback,
    }
  }, [wellness.data, wellness.isLoading, activities.data, activities.isLoading, feedback, loadingFeedback])
}
