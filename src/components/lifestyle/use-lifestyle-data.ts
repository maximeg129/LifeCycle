"use client"

import { useMemo } from 'react'
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import {
  type HealthMetric,
  type HealthGoal,
  getLastDayIds,
  buildDailySeries,
  computeReadiness,
} from './lifestyle-types'

const HISTORY_DAYS = 7

export function useLifestyleData() {
  const { user } = useUser()
  const db = useFirestore()
  const uid = user?.uid ?? null

  const dayIds = useMemo(() => getLastDayIds(HISTORY_DAYS), [])

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

  const derived = useMemo(() => {
    const list = metrics || []
    const dailySeries = buildDailySeries(list, dayIds)
    const latest = [...list].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))[0]
    const readiness = computeReadiness(latest)
    return { dailySeries, latest, readiness }
  }, [metrics, dayIds])

  return {
    uid,
    db,
    dayIds,
    metrics: metrics || [],
    goals: goals || [],
    isLoading: loadingMetrics || loadingGoals,
    ...derived,
  }
}
