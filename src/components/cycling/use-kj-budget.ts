"use client"

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useActivities } from '@/hooks/use-intervals'
import {
  bucketWeeklyKJ,
  baselineKJ,
  currentWeekKJ,
  computeKJTrend,
  computeTargetKJ,
  mondayOf,
  type GovernorStatus,
  type KJTrend,
} from './load-types'

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
// 8 baseline weeks + current week + a couple of buffer weeks for the trend window.
const kjOldest = format(subDays(today, 77), 'yyyy-MM-dd')

export interface KJBudgetSummary {
  realized: number
  baseline: number
  target: number
  trend: KJTrend
  /** False when no session in the window has power data — the budget can't be computed honestly. */
  isAvailable: boolean
  isLoading: boolean
}

/** Shared kJ-budget computation — one Intervals.icu activities fetch, reused by the dashboard widget and the Coach Memory badge. */
export function useKJBudget(governorStatus: GovernorStatus): KJBudgetSummary {
  const activities = useActivities(kjOldest, newest)

  return useMemo(() => {
    const buckets = bucketWeeklyKJ(activities.data)
    const referenceMonday = mondayOf(newest)
    const realized = currentWeekKJ(buckets, referenceMonday)
    const baseline = baselineKJ(buckets, referenceMonday, 8)
    const target = computeTargetKJ(baseline, governorStatus)
    const trend = computeKJTrend(buckets, referenceMonday, 8)
    const isAvailable = buckets.some((b) => b.sessionsWithPower > 0)
    return { realized, baseline, target, trend, isAvailable, isLoading: activities.isLoading }
  }, [activities.data, activities.isLoading, governorStatus])
}
