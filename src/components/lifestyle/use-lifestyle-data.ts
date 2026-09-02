"use client"

import { useMemo } from 'react'
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useWellness } from '@/hooks/use-intervals'
import {
  type HealthMetric,
  type HealthGoal,
  type WellnessLike,
  getLastDayIds,
  buildMergedDailySeries,
  pickLatestWithData,
  computeReadiness,
} from './lifestyle-types'

const HISTORY_DAYS = 7

/**
 * `days` defaults to the 7-day window every existing call site relies on
 * (Vue d'ensemble's latest-value tiles, Proposition du jour's recovery
 * context) — pass a wider value (e.g. from a metric detail page wanting
 * several months of trend) without touching those call sites at all.
 */
export function useLifestyleData(days: number = HISTORY_DAYS) {
  const { user } = useUser()
  const db = useFirestore()
  const uid = user?.uid ?? null

  const dayIds = useMemo(() => getLastDayIds(days), [days])
  const oldestDayId = dayIds[0]
  const newestDayId = dayIds[dayIds.length - 1]

  const metricsQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    return query(
      collection(db, `users/${uid}/healthMetrics`),
      where('date', '>=', Timestamp.fromDate(start)),
      orderBy('date', 'asc')
    )
  }, [db, uid, days])
  const { data: metrics, isLoading: loadingMetrics } = useCollection<HealthMetric>(metricsQuery)

  const goalsQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    return query(collection(db, `users/${uid}/healthGoals`), orderBy('createdAt', 'desc'))
  }, [db, uid])
  const { data: goals, isLoading: loadingGoals } = useCollection<HealthGoal>(goalsQuery)

  // Auto-synced wellness (WHOOP or any device feeding Intervals.icu) — a
  // no-op with empty data when Intervals.icu isn't connected, so this hook
  // degrades gracefully to manual-only entries exactly like before.
  const wellness = useWellness(oldestDayId, newestDayId)

  const derived = useMemo(() => {
    const list = metrics || []
    const wellnessByDay = new Map<string, WellnessLike>(wellness.data.map((w) => [w.id, w]))
    const dailySeries = buildMergedDailySeries(list, wellnessByDay, dayIds)
    const latest = pickLatestWithData(dailySeries)
    const readiness = computeReadiness(latest)
    // Per-day readiness for the whole window (not just the latest day) —
    // only the metric detail pages need this trend; every other call site
    // just ignores it.
    const readinessSeries = dailySeries
      .map((d) => ({ dayId: d.dayId, value: computeReadiness(d) }))
      .filter((d): d is { dayId: string; value: number } => d.value != null)
    return { dailySeries, latest, readiness, readinessSeries }
  }, [metrics, dayIds, wellness.data])

  return {
    uid,
    db,
    dayIds,
    metrics: metrics || [],
    goals: goals || [],
    isLoading: loadingMetrics || loadingGoals || wellness.isLoading,
    // Surfaced so the page can say *why* it's empty (not connected, connected
    // but nothing synced yet, or a fetch error) instead of just showing "—"
    // everywhere and leaving the user to guess.
    wellnessStatus: {
      isConfigured: wellness.isConfigured,
      error: wellness.error,
      hasAnyEntry: wellness.data.length > 0,
    },
    ...derived,
  }
}
