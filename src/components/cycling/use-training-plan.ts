"use client"

// ── Mid/long-term periodized training plan — glue between the AI flow,
// Coach Memory, Intervals.icu form data, and Firestore ──────────────────
//
// One active plan at a time per user. Generating a new plan archives
// whichever plan was previously active rather than deleting it — keeps a
// history without ambiguity about which plan is "the" plan.

import { useCallback, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { buildCoachContext } from './coach-context'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { trainingPlanGeneration } from '@/ai/flows/training-plan-generation-flow'
import {
  clampWeeklyMinutes,
  clampPlanWeeks,
  weeksUntilEvent,
  buildPlanWeekSkeleton,
  mergePlanWeeks,
  type PlanWeek,
} from './training-plan-types'
import type { CoachGoal } from './coach-memory-types'

export interface TrainingPlanDoc {
  userId: string
  name: string
  status: 'active' | 'archived'
  startDate: string
  endDate: string
  eventName: string
  eventDate: string
  weeklyAvailableMinutes: number
  weeks: PlanWeek[]
  warnings: string[]
}

type StoredPlan = TrainingPlanDoc & { id: string }

export function useTrainingPlan() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status)

  const plansQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans, isLoading: isLoadingPlan } = useCollection<StoredPlan>(plansQuery)
  const activePlan = useMemo(() => activePlans?.[0] ?? null, [activePlans])

  const [isGenerating, setIsGenerating] = useState(false)

  const generate = useCallback(async (goal: CoachGoal & { id: string }, rawWeeklyMinutes: number): Promise<boolean> => {
    if (!user || !db) return false
    const today = format(new Date(), 'yyyy-MM-dd')
    const weeklyAvailableMinutes = clampWeeklyMinutes(rawWeeklyMinutes)
    const weekCount = clampPlanWeeks(weeksUntilEvent(today, goal.eventDate))

    setIsGenerating(true)
    try {
      const coachContext = buildCoachContext({
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline },
        governorStatus: governor.status,
      })

      const output = await trainingPlanGeneration({
        today,
        goal: { eventName: goal.eventName, eventDate: goal.eventDate, targetOutcome: goal.targetOutcome, priority: goal.priority },
        weekCount,
        weeklyAvailableMinutes,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
        } : undefined,
        coachContext,
      })

      const skeleton = buildPlanWeekSkeleton(today, weekCount)
      const weeks = mergePlanWeeks(skeleton, output.weeks)

      // Archive whatever was previously active — one active plan at a time.
      const existing = await getDocs(query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active')))
      await Promise.all(existing.docs.map((d) => updateDoc(d.ref, { status: 'archived' }).catch(() => {})))

      const ref = doc(collection(db, `users/${user.uid}/trainingPlans`))
      const data: TrainingPlanDoc & { createdAt: unknown } = {
        userId: user.uid,
        name: output.planName,
        status: 'active',
        startDate: weeks[0]?.startDate ?? today,
        endDate: weeks[weeks.length - 1]?.endDate ?? goal.eventDate,
        eventName: goal.eventName,
        eventDate: goal.eventDate,
        weeklyAvailableMinutes,
        weeks,
        warnings: output.warnings,
        createdAt: serverTimestamp(),
      }
      try {
        await setDoc(ref, data)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data }))
        return false
      }

      toast({ title: 'Plan généré', description: `${output.planName} — ${weekCount} semaines` })
      return true
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "L'IA n'a pas pu générer de plan." })
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [user, db, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, governor.status, athlete.isConfigured, athlete.data, toast])

  const archivePlan = useCallback(async (planId: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/trainingPlans/${planId}`)
    try {
      await updateDoc(ref, { status: 'archived' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: 'archived' } }))
    }
  }, [user, db])

  return {
    activePlan,
    isLoadingPlan,
    isGenerating,
    goals: memory.goals,
    isLoadingGoals: memory.isLoading,
    generate,
    archivePlan,
  }
}
