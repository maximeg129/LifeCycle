"use client"

import { useMemo } from 'react'
import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { type PlannedMeal, getIsoWeekId } from './meal-plan-types'

export function useMealPlan(weekStart: Date) {
  const { user } = useUser()
  const db = useFirestore()
  const weekId = useMemo(() => getIsoWeekId(weekStart), [weekStart])

  const mealsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/mealPlans/${weekId}/meals`), orderBy('date', 'asc'))
  }, [db, user, weekId])
  const { data: meals, isLoading } = useCollection<PlannedMeal>(mealsQuery)

  return { weekId, meals: meals || [], isLoading }
}
