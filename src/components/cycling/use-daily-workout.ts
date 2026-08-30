"use client"

// ── "Proposition du jour" — glue between the AI flow, Coach Memory,
// Intervals.icu form data, and Firestore ──────────────────────────────
//
// One proposal per calendar day (users/{uid}/workoutProposals/{yyyy-MM-dd}),
// overwritten on regenerate. Generation reuses the same context sources as
// the recovery-insight flow (buildCoachContext, governor, kJ budget) plus
// fresh CTL/ATL/TSB, the last 7 days of completed sessions, and last
// night's sleep/HRV/readiness (useLifestyleData — same merged auto-synced
// Intervals.icu + manual series Vie & Santé shows), so the suggestion
// reflects the same "form" the rest of the app already computes — not a
// second, disconnected notion of readiness.

import { useCallback, useMemo, useState } from 'react'
import { collection, doc, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { format, subDays } from 'date-fns'
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete, useActivities } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { buildCoachContext } from './coach-context'
import { dailyWorkoutRecommendation, type DailyWorkoutRecommendationOutput } from '@/ai/flows/daily-workout-recommendation-flow'
import { clampAvailableMinutes, summarizeRecentSessions, buildWorkoutEventPayload } from './daily-workout-types'
import { currentPlanWeek, type PlanWeek } from './training-plan-types'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'

interface IntervalsCredentialsDoc {
  intervalsAthleteId?: string
  intervalsApiKey?: string
}

export interface StoredRide {
  location: string
  departureDateTime: string
}

interface StoredWorkoutProposal {
  userId: string
  availableMinutes: number
  proposal: DailyWorkoutRecommendationOutput
  sentToIntervals?: boolean
  ride?: StoredRide | null
}

const SESSIONS_WINDOW_DAYS = 7

export function useDailyWorkout() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status)
  // Same merged (auto-synced Intervals.icu + manual) daily series as Vie &
  // Santé — a bad night should measurably change today's proposal, not
  // just the training-load side of the decision.
  const lifestyle = useLifestyleData()

  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const sessionsOldest = useMemo(() => format(subDays(new Date(), SESSIONS_WINDOW_DAYS), 'yyyy-MM-dd'), [])
  const recentActivities = useActivities(sessionsOldest, todayId)

  const proposalRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/workoutProposals/${todayId}`)
  }, [db, user, todayId])
  const { data: stored, isLoading: loadingStored } = useDoc<StoredWorkoutProposal>(proposalRef)

  // The active mid/long-term plan, if any — so today's proposal fits the
  // current phase/focus instead of being generated in a vacuum (see
  // training-plan-types.ts / training-plan-generation-flow.ts).
  const activePlanQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans } = useCollection<{ weeks: PlanWeek[] }>(activePlanQuery)
  const planWeek = useMemo(() => {
    const plan = activePlans?.[0]
    return plan ? currentPlanWeek(plan.weeks, todayId) : null
  }, [activePlans, todayId])

  // Intervals credentials — read directly rather than through IntervalsProvider,
  // which deliberately doesn't expose the raw athleteId/apiKey past its own
  // proxy-fetch boundary (see use-intervals.tsx's useIntervalsCredentials).
  const credsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: creds } = useDoc<IntervalsCredentialsDoc>(credsRef)
  const canSendToIntervals = !!creds?.intervalsAthleteId && !!creds?.intervalsApiKey

  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const generate = useCallback(async (rawMinutes: number, ride?: StoredRide): Promise<DailyWorkoutRecommendationOutput | null> => {
    if (!user || !db) return null
    const availableMinutes = clampAvailableMinutes(rawMinutes)
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

      const result = await dailyWorkoutRecommendation({
        date: todayId,
        availableMinutes,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          rampRate: athlete.data.rampRate,
        } : undefined,
        recentSessions: summarizeRecentSessions(recentActivities.data, todayId, SESSIONS_WINDOW_DAYS),
        planWeek: planWeek ? {
          weekNumber: planWeek.weekNumber,
          phase: planWeek.phase,
          focus: planWeek.focus,
          targetWeeklyMinutes: planWeek.targetWeeklyMinutes,
        } : undefined,
        recovery: lifestyle.latest ? {
          sleepHours: lifestyle.latest.sleepHours,
          sleepQuality: lifestyle.latest.sleepQuality,
          hrv: lifestyle.latest.hrv,
          readiness: lifestyle.readiness ?? undefined,
        } : undefined,
        coachContext,
        ride,
      })
      if (!result.ok) {
        toast({ variant: 'destructive', title: "L'IA n'a pas pu générer de séance", description: result.error })
        return null
      }
      const proposal = result.data

      const ref = doc(db, `users/${user.uid}/workoutProposals/${todayId}`)
      const data = {
        userId: user.uid,
        availableMinutes,
        proposal,
        sentToIntervals: false,
        ride: ride ?? null,
        createdAt: serverTimestamp(),
      }
      try {
        await setDoc(ref, data)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data }))
      }

      return proposal
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      toast({ variant: 'destructive', title: "L'IA n'a pas pu générer de séance", description: message })
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [user, db, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, governor.status, todayId, athlete.isConfigured, athlete.data, recentActivities.data, planWeek, lifestyle.latest, lifestyle.readiness, toast])

  const sendToIntervals = useCallback(async (proposal: DailyWorkoutRecommendationOutput): Promise<boolean> => {
    if (!creds?.intervalsAthleteId || !creds?.intervalsApiKey) {
      toast({ variant: 'destructive', title: 'Intervals.icu non connecté', description: 'Renseignez vos identifiants dans Réglages.' })
      return false
    }
    setIsSending(true)
    try {
      const event = buildWorkoutEventPayload(proposal, todayId)
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

      if (user && db) {
        const ref = doc(db, `users/${user.uid}/workoutProposals/${todayId}`)
        await updateDoc(ref, { sentToIntervals: true, sentAt: serverTimestamp() }).catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { sentToIntervals: true } }))
        })
      }

      toast({ title: 'Envoyé sur Intervals.icu', description: `${proposal.title} — ${format(new Date(), 'dd/MM/yyyy')}` })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      toast({ variant: 'destructive', title: "Échec de l'envoi", description: message })
      return false
    } finally {
      setIsSending(false)
    }
  }, [creds, user, db, todayId, toast])

  return {
    stored: stored?.proposal ?? null,
    storedAvailableMinutes: stored?.availableMinutes ?? null,
    storedRide: stored?.ride ?? null,
    sentToIntervals: stored?.sentToIntervals ?? false,
    planWeek,
    recovery: lifestyle.latest ? { ...lifestyle.latest, readiness: lifestyle.readiness } : null,
    isLoadingStored: loadingStored,
    isGenerating,
    isSending,
    canSendToIntervals,
    generate,
    sendToIntervals,
  }
}
