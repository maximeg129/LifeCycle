"use client"

import { collection, doc, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import type { Injury, CoachGoal, CoachLifestyle, CoachFacts } from './coach-memory-types'

export function useCoachMemory() {
  const { user } = useUser()
  const db = useFirestore()

  const injuriesQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/coachInjuries`), orderBy('createdAt', 'desc'))
  }, [db, user])
  const { data: injuries, isLoading: loadingInjuries } = useCollection<Injury>(injuriesQuery)

  const goalsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/coachGoals`), orderBy('createdAt', 'desc'))
  }, [db, user])
  const { data: goals, isLoading: loadingGoals } = useCollection<CoachGoal>(goalsQuery)

  const lifestyleRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/coachMemory/lifestyle`)
  }, [db, user])
  const { data: lifestyle, isLoading: loadingLifestyle } = useDoc<CoachLifestyle>(lifestyleRef)

  const factsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/coachMemory/facts`)
  }, [db, user])
  const { data: facts, isLoading: loadingFacts } = useDoc<CoachFacts>(factsRef)

  return {
    uid: user?.uid ?? null,
    db,
    injuries: injuries || [],
    goals: goals || [],
    lifestyle: lifestyle ?? null,
    rememberedFacts: facts?.items ?? [],
    isLoading: loadingInjuries || loadingGoals || loadingLifestyle || loadingFacts,
  }
}
