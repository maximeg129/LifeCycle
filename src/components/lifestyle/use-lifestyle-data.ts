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
  resolveReadiness,
} from './lifestyle-types'

const HISTORY_DAYS = 7

export function useLifestyleData() {
  const { user } = useUser()
  const db = useFirestore()
  const uid = user?.uid ?? null

  const dayIds = useMemo(() => getLastDayIds(HISTORY_DAYS), [])
  const oldestDayId = dayIds[0]
  const newestDayId = dayIds[dayIds.length - 1]

  const metricsQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    const start = new Date()
    start.setDate(start.getDate() - (HISTORY_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    return query(
      collection(db, `users/${uid}/healthMetrics`),
      where('date', '>=', Timestamp.fromDate(start)),
      orderBy('date', 'asc')
    )
  }, [db, uid])
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
    const latestWellness = latest ? wellnessByDay.get(latest.dayId) : undefined
    const readiness = resolveReadiness(latest, latestWellness?.readiness)
    return { dailySeries, latest, readiness }
  }, [metrics, dayIds, wellness.data])

  return {
    uid,
    db,
    dayIds,
    metrics: metrics || [],
    goals: goals || [],
    isLoading: loadingMetrics || loadingGoals || wellness.isLoading,
    ...derived,
  }
}
