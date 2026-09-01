"use client"

// ── Mid/long-term periodized training plan — glue between the AI flow,
// Coach Memory, Intervals.icu form data, and Firestore ──────────────────
//
// One active plan at a time per user. Generating a new plan archives
// whichever plan was previously active rather than deleting it — keeps a
// history without ambiguity about which plan is "the" plan.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { usePowerCurve } from './use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { fitCriticalPower } from '@/domain/cycling/metrics/criticalPower'
import { trainingPlanGeneration } from '@/ai/flows/training-plan-generation-flow'
import { planWeekSessions, type PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'
import {
  clampWeeklyMinutes,
  clampPlanWeeks,
  weeksUntilEvent,
  buildPlanWeekSkeleton,
  mergePlanWeeks,
  planSessionExternalId,
  weekNeedsRecalibration,
  computeActualWeeklyMinutes,
  diffPlanWeeks,
  applyRecalibration,
  type PlanWeek,
  type PlanWeekChange,
} from './training-plan-types'
import { buildWorkoutEventPayload } from './daily-workout-types'
import type { CoachGoal } from './coach-memory-types'
import type { CoachReason } from '@/ai/coach/outputContract'
import { trainingPlanRecalibration } from '@/ai/flows/training-plan-recalibration-flow'
import { useActivities } from '@/hooks/use-intervals'
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
  /** Résultat visé, dans les mots de l'athlète (CoachGoal.targetOutcome) — capturé à la génération pour que la recalibration puisse juger si la trajectoire actuelle reste crédible pour CET objectif précis. Absent sur un plan créé avant cet ajout. */
  targetOutcome?: string
  weeklyAvailableMinutes: number
  weeks: PlanWeek[]
  warnings: string[]
  /**
   * Paragraphe expliquant la logique du plan (retour utilisateur : "quelle
   * base il prend pour proposer ce plan... quelles sont les attentes
   * physiologiques") — champ "summary" du contrat de sortie coach
   * (withCoachOutputContract), redéfini plus richement pour ce flow. Absent
   * sur un plan généré avant cet ajout (undefined, pas une chaîne vide).
   */
  summary?: string
  /** Règles citées derrière le plan (withCoachOutputContract) — même champ que daily-workout-tab.tsx, absent sur un plan ancien. */
  reasons?: CoachReason[]
  /** Verdict du contrat de sortie coach à la génération — jusqu'ici calculé mais jamais affiché (vrai oubli, corrigé ici). La bannière affichée à l'athlète utilise le verdict de la DERNIÈRE recalibration si elle existe (plus à jour), sinon celui-ci. */
  verdict?: 'ok' | 'warn' | 'block'
  /** "Une action concrète et immédiate" (champ du contrat de sortie coach) — distinct de summary, utilisé pour le texte de la bannière verdict plutôt que de dupliquer le paragraphe d'explication. */
  recommendation?: string
  /**
   * Trace du plan tel que généré à l'origine — capturé UNE SEULE FOIS à la
   * création, jamais retouché par une recalibration (retour utilisateur :
   * "on garderais un trace du plan d'origine pour pouvoir comprendre les
   * impacts des changement"). Absent sur un plan créé avant cet ajout.
   */
  originalWeeks?: PlanWeek[]
  /**
   * Journal des recalibrations automatiques (voir weekNeedsRecalibration/
   * runRecalibration ci-dessous) — append-only, jamais réécrit. Absent tant
   * qu'aucune recalibration n'a encore eu lieu.
   */
  recalibrations?: PlanRecalibrationEntry[]
}

export interface PlanRecalibrationEntry {
  /** yyyy-MM-dd — quand cette recalibration a tourné. */
  date: string
  /** La semaine dont la fin a déclenché cette recalibration — jamais retouchée elle-même. */
  throughWeekNumber: number
  /** Explication (champ "summary" du contrat de sortie coach) — "pourquoi le plan a changé". */
  summary: string
  /** "Une action concrète et immédiate" (champ du contrat de sortie coach) — distinct de summary, utilisé pour le texte de la bannière verdict plutôt que de dupliquer le paragraphe d'explication. */
  recommendation: string
  reasons: CoachReason[]
  /** Uniquement les semaines dont le contenu a réellement changé — vide si la recalibration a confirmé le plan existant. */
  changes: PlanWeekChange[]
  /** Verdict du contrat de sortie coach à CETTE recalibration — la lecture la plus à jour de l'état du plan. */
  verdict: 'ok' | 'warn' | 'block'
  /**
   * Bilan critique de la trajectoire actuelle vers l'objectif — retour
   * utilisateur : "le coach peut il émettre une critique sur le plan ou des
   * recommendations scientifiquement détaillée". Automatique, au même
   * déclenchement que la recalibration elle-même (décision utilisateur du
   * 31 août 2026) plutôt qu'un flow séparé à la demande.
   */
  strengths: string[]
  risks: string[]
}

type StoredPlan = TrainingPlanDoc & { id: string }

export function useTrainingPlan() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status, athlete.data?.weight)
  // Retour utilisateur : "on utilise tous les indicateurs qu'on a développé
  // précédemment... en croisant le plus de données disponibles" — mêmes
  // indices (endurance/CP-W′) que les autres flows coach, calculés une
  // seule fois ici et réutilisés par les 3 appels buildCoachContext de ce
  // hook (génération, recalibration, séances type d'une semaine).
  const powerCurve = usePowerCurve()
  const powerRecords = [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  const enduranceIndex = fitEnduranceCurve(powerRecords)?.enduranceIndex ?? null
  const criticalPowerModel = fitCriticalPower(powerRecords)

  const plansQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans, isLoading: isLoadingPlan } = useCollection<StoredPlan>(plansQuery)
  const activePlan = useMemo(() => activePlans?.[0] ?? null, [activePlans])

  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  // Activités réelles sur toute la durée du plan actif — servent uniquement
  // à calculer le volume réellement réalisé par semaine pour la
  // recalibration automatique (voir runRecalibration plus bas). Bornes
  // dégradées sur todayId si aucun plan actif (la query ne sert alors à
  // rien, mais useActivities exige des bornes non-optionnelles).
  const planActivities = useActivities(activePlan?.startDate ?? todayId, todayId)

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

  const generate = useCallback(async (
    goal: CoachGoal & { id: string },
    rawWeeklyMinutes: number,
    strength?: { include: boolean; weeklyMinutes?: number }
  ): Promise<boolean> => {
    if (!user || !db) return false
    const today = format(new Date(), 'yyyy-MM-dd')
    const weeklyAvailableMinutes = clampWeeklyMinutes(rawWeeklyMinutes)
    const weekCount = clampPlanWeeks(weeksUntilEvent(today, goal.eventDate))

    setIsGenerating(true)
    try {
      const coachContext = buildCoachContext({
        today,
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline, trend: budget.trend, exceedsThresholdKJPerKg: budget.exceedsThresholdKJPerKg },
        governorStatus: governor.status,
        trainingLoad: governor.trainingLoad,
        enduranceIndex,
        criticalPower: criticalPowerModel ? { cpWatts: criticalPowerModel.cpWatts, wPrimeKJ: criticalPowerModel.wPrimeJoules / 1000 } : null,
      })

      const result = await trainingPlanGeneration({
        today,
        goal: { eventName: goal.eventName, eventDate: goal.eventDate, targetOutcome: goal.targetOutcome, priority: goal.priority },
        weekCount,
        weeklyAvailableMinutes,
        includeStrengthTraining: strength?.include,
        strengthWeeklyMinutes: strength?.weeklyMinutes,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          ftp: athlete.data.ftp,
          weightKg: athlete.data.weight,
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
        targetOutcome: goal.targetOutcome,
        weeklyAvailableMinutes,
        weeks,
        warnings: output.warnings,
        summary: output.summary,
        reasons: output.reasons,
        verdict: output.verdict,
        recommendation: output.recommendation,
        // Capturé une seule fois, ici, à la création — jamais retouché par
        // une recalibration (voir runRecalibration plus bas), pour garder
        // une vraie trace du plan d'origine.
        originalWeeks: weeks,
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
  }, [user, db, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, athlete.isConfigured, athlete.data, toast])

  // ── Recalibration automatique — retour utilisateur du 31 août 2026 ──────
  //
  // Déclenchement "automatique" tel que ce projet peut le faire : pas de
  // cron serveur (Server Actions uniquement, voir CLAUDE.md) — donc dès que
  // l'athlète ouvre l'onglet Plan (ce hook n'a qu'un seul appelant,
  // training-plan-tab.tsx) et qu'une semaine vient de se terminer sans
  // avoir encore été prise en compte (weekNeedsRecalibration), la
  // recalibration tourne silencieusement — pas de bouton, pas de
  // confirmation, mais le résultat est documenté (recalibrations[]) pour
  // que l'athlète comprenne après coup pourquoi le plan a changé.
  const recalibratingRef = useRef(false)

  const runRecalibration = useCallback(async (plan: StoredPlan, throughWeekNumber: number) => {
    if (!user || !db || recalibratingRef.current) return
    const completedWeek = plan.weeks.find((w) => w.weekNumber === throughWeekNumber)
    const remainingWeeks = plan.weeks.filter((w) => w.weekNumber > throughWeekNumber)
    if (!completedWeek || remainingWeeks.length === 0) return

    recalibratingRef.current = true
    try {
      const actualMinutes = computeActualWeeklyMinutes(
        planActivities.data
          .filter((a) => a.start_date_local)
          .map((a) => ({ startDate: (a.start_date_local as string).slice(0, 10), durationMinutes: (a.moving_time ?? 0) / 60 })),
        completedWeek
      )

      const coachContext = buildCoachContext({
        today: todayId,
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline, trend: budget.trend, exceedsThresholdKJPerKg: budget.exceedsThresholdKJPerKg },
        governorStatus: governor.status,
        trainingLoad: governor.trainingLoad,
        enduranceIndex,
        criticalPower: criticalPowerModel ? { cpWatts: criticalPowerModel.cpWatts, wPrimeKJ: criticalPowerModel.wPrimeJoules / 1000 } : null,
      })

      const result = await trainingPlanRecalibration({
        today: todayId,
        eventName: plan.eventName,
        eventDate: plan.eventDate,
        targetOutcome: plan.targetOutcome,
        throughWeekNumber,
        completedWeek: {
          phase: completedWeek.phase,
          focus: completedWeek.focus,
          targetWeeklyMinutes: completedWeek.targetWeeklyMinutes,
          actualMinutes: Math.round(actualMinutes),
        },
        remainingWeeks: remainingWeeks.map((w) => ({
          weekNumber: w.weekNumber,
          phase: w.phase,
          focus: w.focus,
          targetWeeklyMinutes: w.targetWeeklyMinutes,
          notes: w.notes,
        })),
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          ftp: athlete.data.ftp,
          weightKg: athlete.data.weight,
        } : undefined,
        coachContext,
      })
      // Échec silencieux — pas de toast : ce n'est pas une action que
      // l'athlète a demandée, un échec ne doit pas interrompre sa visite de
      // l'onglet. La recalibration sera retentée à la prochaine ouverture
      // (recalibratedThroughWeek n'a pas avancé).
      if (!result.ok) {
        console.error('[useTrainingPlan] recalibration failed:', result.error)
        return
      }
      const output = result.data

      const changes = diffPlanWeeks(plan.weeks, output.adjustedWeeks)
      const updatedWeeks = applyRecalibration(plan.weeks, output.adjustedWeeks)
      const entry: PlanRecalibrationEntry = {
        date: todayId,
        throughWeekNumber,
        summary: output.summary,
        recommendation: output.recommendation,
        reasons: output.reasons,
        changes,
        verdict: output.verdict,
        strengths: output.strengths,
        risks: output.risks,
      }

      const ref = doc(db, `users/${user.uid}/trainingPlans/${plan.id}`)
      const data = {
        weeks: updatedWeeks,
        recalibrations: [...(plan.recalibrations ?? []), entry],
      }
      try {
        await updateDoc(ref, data)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: data }))
      }
    } finally {
      recalibratingRef.current = false
    }
  }, [user, db, planActivities.data, todayId, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, athlete.isConfigured, athlete.data])

  useEffect(() => {
    if (!activePlan || isLoadingPlan || planActivities.isLoading) return
    const dueThroughWeek = weekNeedsRecalibration(activePlan.weeks, activePlan.recalibrations?.at(-1)?.throughWeekNumber, todayId)
    if (dueThroughWeek == null) return
    runRecalibration(activePlan, dueThroughWeek)
    // activePlan/planActivities change identity on every Firestore snapshot
    // (even a no-op one) — depending on the full objects would re-fire this
    // effect constantly. recalibratingRef + the recalibrations[] write
    // itself (which moves the due week forward) are the real guards against
    // duplicate/repeated runs, not this dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlan?.id, activePlan?.weeks.length, todayId, isLoadingPlan, planActivities.isLoading])

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
        today: format(new Date(), 'yyyy-MM-dd'),
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline, trend: budget.trend, exceedsThresholdKJPerKg: budget.exceedsThresholdKJPerKg },
        governorStatus: governor.status,
        trainingLoad: governor.trainingLoad,
        enduranceIndex,
        criticalPower: criticalPowerModel ? { cpWatts: criticalPowerModel.cpWatts, wPrimeKJ: criticalPowerModel.wPrimeJoules / 1000 } : null,
      })

      const result = await planWeekSessions({
        weekNumber: week.weekNumber,
        phase: week.phase,
        focus: week.focus,
        targetWeeklyMinutes: week.targetWeeklyMinutes,
        targetStrengthMinutes: week.targetStrengthMinutes,
        notes: week.notes,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          ftp: athlete.data.ftp,
          weightKg: athlete.data.weight,
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
  }, [user, db, activePlan, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, athlete.isConfigured, athlete.data, toast])

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
