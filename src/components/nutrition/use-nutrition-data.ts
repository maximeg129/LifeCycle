"use client"

import { useMemo } from 'react'
import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import { type MealLog, type HydrationLog, type NutritionGoals, getDayId, sumMeals, DEFAULT_GOALS } from './nutrition-types'

export function useNutritionData() {
  const { user } = useUser()
  const db = useFirestore()
  const todayId = useMemo(() => getDayId(new Date()), [])

  const mealsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return query(
      collection(db, `users/${user.uid}/mealLogs`),
      where('date', '>=', Timestamp.fromDate(start)),
      where('date', '<=', Timestamp.fromDate(end)),
      orderBy('date', 'asc')
    )
  }, [db, user])
  const { data: meals, isLoading: loadingMeals } = useCollection<MealLog>(mealsQuery)

  const hydrationRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/hydrationLogs/${todayId}`)
  }, [db, user, todayId])
  const { data: hydration, isLoading: loadingHydration } = useDoc<HydrationLog>(hydrationRef)

  const goalsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/nutrition`)
  }, [db, user])
  const { data: goals, isLoading: loadingGoals } = useDoc<NutritionGoals>(goalsRef)

  const totals = useMemo(() => sumMeals(meals || []), [meals])

  return {
    uid: user?.uid ?? null,
    db,
    todayId,
    meals: meals || [],
    totals,
    hydrationLiters: hydration?.liters ?? 0,
    goals: {
      calorieTarget: goals?.calorieTarget ?? DEFAULT_GOALS.calorieTarget,
      proteinTarget: goals?.proteinTarget ?? DEFAULT_GOALS.proteinTarget,
      carbsTarget: goals?.carbsTarget ?? DEFAULT_GOALS.carbsTarget,
      hydrationTargetLiters: goals?.hydrationTargetLiters ?? DEFAULT_GOALS.hydrationTargetLiters,
    },
    isLoading: loadingMeals || loadingHydration || loadingGoals,
  }
}
