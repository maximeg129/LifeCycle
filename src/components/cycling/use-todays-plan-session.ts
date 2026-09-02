"use client"

// ── Aperçu léger, en lecture seule, de la séance prévue par le plan ──────
//
// Retour utilisateur : "mettre sous les indicateurs clef du jour la
// séance « prévue » au plan du jour". Cyclisme reste la page données
// (voir CLAUDE.md "Coach" — "Cyclisme redevient purement la page
// données") : ce hook ne fait QUE lire l'état déjà présent en Firestore,
// jamais de génération IA ni de mutation — contrairement à
// use-daily-workout.ts/use-training-plan.ts (qui restent les seuls à
// déclencher la génération elle-même, voir use-generate-week-sessions.ts).
// Visiter Cyclisme avant Coach peut donc afficher un plan actif sans
// encore connaître la séance précise du jour (semaine pas encore
// composée) — dégradé gracieusement (voir `weekGenerated` ci-dessous)
// plutôt que de déclencher un appel IA depuis cette page.

import { useMemo } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { currentPlanWeek, type PlanWeek, type PlanWeekSessionWithValidation } from './training-plan-types'

interface StoredPlanLike {
  weeks: PlanWeek[]
}

export interface TodaysPlanSessionResult {
  isLoading: boolean
  hasActivePlan: boolean
  /** La semaine du plan couvrant aujourd'hui — null si aucun plan actif, ou si aujourd'hui tombe hors de la plage du plan (pas encore démarré ou déjà terminé). */
  week: PlanWeek | null
  /** true dès que week.sampleSessions existe (semaine composée par l'IA, lazy — voir "vue calendrier v2", CLAUDE.md) — permet de distinguer "repos" (semaine composée, rien aujourd'hui) de "pas encore su" (semaine pas encore composée). */
  weekGenerated: boolean
  /** La séance datée aujourd'hui dans la semaine ci-dessus — null pour un jour de repos, ou tant que la semaine n'est pas composée. */
  session: PlanWeekSessionWithValidation | null
}

export function useTodaysPlanSession(): TodaysPlanSessionResult {
  const { user } = useUser()
  const db = useFirestore()
  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const plansQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans, isLoading } = useCollection<StoredPlanLike>(plansQuery)
  const activePlan = activePlans?.[0] ?? null

  const week = useMemo(() => (activePlan ? currentPlanWeek(activePlan.weeks, todayId) : null), [activePlan, todayId])
  const weekGenerated = !!week?.sampleSessions
  const session = useMemo(() => {
    if (!week?.sampleSessions) return null
    return week.sampleSessions.find((s) => s.date === todayId) ?? null
  }, [week, todayId])

  return { isLoading, hasActivePlan: !!activePlan, week, weekGenerated, session }
}
