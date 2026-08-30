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
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { buildCoachContext } from './coach-context'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { trainingPlanGeneration } from '@/ai/flows/training-plan-generation-flow'
import { planWeekSessions, type PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'
import {
  clampWeeklyMinutes,
  clampPlanWeeks,
  weeksUntilEvent,
  buildPlanWeekSkeleton,
  mergePlanWeeks,
  planSessionExternalId,
  type PlanWeek,
} from './training-plan-types'
import { buildWorkoutEventPayload } from './daily-workout-types'
import type { CoachGoal } from './coach-memory-types'
import { describeActionDispatchError } from '@/lib/utils'

interface IntervalsCredentialsDoc {
  intervalsAthleteId?: string
  intervalsApiKey?: string
}

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

  // Intervals credentials — same direct-read pattern as use-daily-workout.ts
  // (IntervalsProvider deliberately doesn't expose the raw athleteId/apiKey).
  const credsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: creds } = useDoc<IntervalsCredentialsDoc>(credsRef)
  const canSendToIntervals = !!creds?.intervalsAthleteId && !!creds?.intervalsApiKey

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingSessionsForWeek, setGeneratingSessionsForWeek] = useState<number | null>(null)
  const [sendingSessionKey, setSendingSessionKey] = useState<string | null>(null)

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

      const result = await trainingPlanGeneration({
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
      if (!result.ok) {
        toast({ variant: 'destructive', title: "L'IA n'a pas pu générer de plan", description: result.error })
        return false
      }
      const output = result.data

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
    } catch (e) {
      toast({ variant: 'destructive', title: "L'IA n'a pas pu générer de plan", description: describeActionDispatchError(e) })
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

  /**
   * Lazily generates (once) and caches a week's example sessions. Firestore
   * has no way to patch a single array element, so this reads the plan's
   * current `weeks` array from state, replaces just the target week's
   * `sampleSessions`, and writes the whole array back.
   */
  const generateWeekSessions = useCallback(async (week: PlanWeek): Promise<boolean> => {
    if (!user || !db || !activePlan) return false
    setGeneratingSessionsForWeek(week.weekNumber)
    try {
      const coachContext = buildCoachContext({
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline },
        governorStatus: governor.status,
      })

      const result = await planWeekSessions({
        weekNumber: week.weekNumber,
        phase: week.phase,
        focus: week.focus,
        targetWeeklyMinutes: week.targetWeeklyMinutes,
        notes: week.notes,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
        } : undefined,
        coachContext,
      })
      if (!result.ok) {
        toast({ variant: 'destructive', title: "L'IA n'a pas pu générer les séances de la semaine", description: result.error })
        return false
      }

      const weeks = activePlan.weeks.map((w) =>
        w.weekNumber === week.weekNumber ? { ...w, sampleSessions: result.data.sessions } : w
      )
      const ref = doc(db, `users/${user.uid}/trainingPlans/${activePlan.id}`)
      try {
        await updateDoc(ref, { weeks })
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { weeks } }))
        return false
      }
      return true
    } catch (e) {
      toast({ variant: 'destructive', title: "L'IA n'a pas pu générer les séances de la semaine", description: describeActionDispatchError(e) })
      return false
    } finally {
      setGeneratingSessionsForWeek(null)
    }
  }, [user, db, activePlan, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, governor.status, athlete.isConfigured, athlete.data, toast])

  /** Pushes one plan-week sample session to Intervals.icu on a chosen date — same event path as "Proposition du jour", with a date-independent externalId so re-picking the date moves rather than duplicates the entry. */
  const sendSessionToIntervals = useCallback(async (
    session: PlanWeekSession,
    weekNumber: number,
    sessionIndex: number,
    dateId: string
  ): Promise<boolean> => {
    if (!activePlan) return false
    if (!creds?.intervalsAthleteId || !creds?.intervalsApiKey) {
      toast({ variant: 'destructive', title: 'Intervals.icu non connecté', description: 'Renseignez vos identifiants dans Réglages.' })
      return false
    }
    const key = `${weekNumber}-${sessionIndex}`
    setSendingSessionKey(key)
    try {
      const externalId = planSessionExternalId(activePlan.id, weekNumber, sessionIndex)
      const event = buildWorkoutEventPayload(session, dateId, externalId)
      const res = await fetch('/api/intervals/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intervals-athlete-id': creds.intervalsAthleteId,
          'x-intervals-api-key': creds.intervalsApiKey,
        },
        body: JSON.stringify(event),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      toast({ title: 'Envoyé sur Intervals.icu', description: `${session.title} — ${format(new Date(`${dateId}T00:00:00`), 'dd/MM/yyyy')}` })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      toast({ variant: 'destructive', title: "Échec de l'envoi", description: message })
      return false
    } finally {
      setSendingSessionKey(null)
    }
  }, [activePlan, creds, toast])

  return {
    activePlan,
    isLoadingPlan,
    isGenerating,
    goals: memory.goals,
    isLoadingGoals: memory.isLoading,
    generate,
    archivePlan,
    generateWeekSessions,
    generatingSessionsForWeek,
    sendSessionToIntervals,
    sendingSessionKey,
    canSendToIntervals,
  }
}
