"use client"

// ── Recalibration automatique du plan — extrait de use-training-plan.ts
// pour être réutilisable ailleurs, même raison que use-generate-week-
// sessions.ts (extrait pour le même besoin) : "ajuster son plan simplement
// avec les discussions de Stella" (voir CLAUDE.md, chantier "Stella ajuste
// le plan") — Stella doit pouvoir déclencher CE MÊME chemin (le bilan réel
// vs cible, le même flow IA, la même écriture Firestore) depuis la
// conversation, sans dupliquer la logique ni refetcher ce que l'appelant a
// déjà en main.
//
// Prend en paramètre les données déjà chargées par l'appelant (plan actif,
// activités réelles sur sa durée, mémoire coach, budget kJ, gouverneur,
// indices de puissance, athlète) — use-training-plan.ts les a toutes déjà
// pour son propre appel IA (génération/recalibration), donc brancher un
// second appelant (use-coach-chat.ts) n'introduit aucune lecture Firestore/
// Intervals.icu qu'il n'aurait pas déjà pour ses propres besoins.

import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, updateDoc, type Firestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { buildCoachContext } from './coach-context'
import { trainingPlanRecalibration } from '@/ai/flows/training-plan-recalibration-flow'
import { weekNeedsRecalibration, computeActualWeeklyMinutes, diffPlanWeeks, applyRecalibration, type PlanWeek, type PlanWeekChange } from './training-plan-types'
import type { useCoachMemory } from './use-coach-memory'
import type { useKJBudget } from './use-kj-budget'
import type { useGovernor } from './use-governor'
import type { useAthlete } from '@/hooks/use-intervals'
import type { CriticalPowerModel } from '@/domain/cycling/metrics/criticalPower'
import type { CoachReason } from '@/ai/coach/outputContract'

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
  strengths: string[]
  risks: string[]
}

/** Sous-ensemble du plan actif requis ici — n'importe quel plan chargé par l'appelant (StoredPlan de use-training-plan.ts) satisfait cette forme. */
export interface RecalibratablePlan {
  id: string
  eventName: string
  eventDate: string
  targetOutcome?: string
  weeks: PlanWeek[]
  recalibrations?: PlanRecalibrationEntry[]
}

interface RecalibratePlanDeps {
  user: User | null | undefined
  db: Firestore | null | undefined
  activePlan: RecalibratablePlan | null | undefined
  isLoadingPlan: boolean
  /** Activités réelles sur toute la durée du plan — pour le volume réellement réalisé (computeActualWeeklyMinutes). */
  planActivities: { data: { start_date_local?: string; moving_time?: number }[]; isLoading: boolean }
  todayId: string
  memory: ReturnType<typeof useCoachMemory>
  budget: ReturnType<typeof useKJBudget>
  governor: ReturnType<typeof useGovernor>
  enduranceIndex: number | null
  criticalPowerModel: CriticalPowerModel | null
  athlete: ReturnType<typeof useAthlete>
  /**
   * `false` désactive le déclenchement AUTOMATIQUE à l'ouverture
   * (weekNeedsRecalibration, silencieux) — use-coach-chat.ts l'utilise
   * ainsi : la recalibration n'y tourne QUE sur demande explicite de
   * l'athlète via Stella (recalibrateNow), jamais silencieusement à
   * l'ouverture du chat (contrairement à l'onglet Plan, son seul autre
   * appelant, où le déclenchement automatique reste la règle établie).
   * `true` par défaut — comportement identique à avant cette extraction.
   */
  autoTrigger?: boolean
}

export function useRecalibratePlan(deps: RecalibratePlanDeps) {
  const { user, db, activePlan, isLoadingPlan, planActivities, todayId, memory, budget, governor, enduranceIndex, criticalPowerModel, athlete, autoTrigger = true } = deps
  const { toast } = useToast()
  const recalibratingRef = useRef(false)
  // Reflète recalibratingRef pour l'UI (le ref seul ne déclenche pas de
  // re-render) — utile pour recalibrateNow (déclenchement explicite),
  // l'automatique reste silencieux.
  const [isRecalibrating, setIsRecalibrating] = useState(false)

  const runRecalibration = useCallback(async (plan: RecalibratablePlan, throughWeekNumber: number) => {
    if (!user || !db || recalibratingRef.current) return
    const completedWeek = plan.weeks.find((w) => w.weekNumber === throughWeekNumber)
    const remainingWeeks = plan.weeks.filter((w) => w.weekNumber > throughWeekNumber)
    if (!completedWeek || remainingWeeks.length === 0) return

    recalibratingRef.current = true
    setIsRecalibrating(true)
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
      // Échec silencieux — pas de toast quand c'est l'automatique qui a
      // déclenché : ce n'est pas une action que l'athlète a demandée. Un
      // appel explicite (recalibrateNow) reste informé via son propre
      // toast, posé par l'appelant après ce return.
      if (!result.ok) {
        console.error('[useRecalibratePlan] recalibration failed:', result.error)
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
      setIsRecalibrating(false)
    }
  }, [user, db, planActivities.data, todayId, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, athlete.isConfigured, athlete.data])

  useEffect(() => {
    if (!autoTrigger) return
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
  }, [autoTrigger, activePlan?.id, activePlan?.weeks.length, todayId, isLoadingPlan, planActivities.isLoading])

  /**
   * Déclenche immédiatement la vérification de recalibration plutôt que
   * d'attendre la prochaine ouverture de l'onglet — retour utilisateur :
   * "en gardant l'option peut-être via un bouton, de réajuster le plan
   * basé sur ce qui a été réalistiquement fait". Même chemin que le
   * déclenchement automatique (weekNeedsRecalibration + runRecalibration),
   * donc les mêmes garde-fous : si rien n'est dû, ne force RIEN et le dit
   * honnêtement plutôt que de re-recalibrer une semaine déjà traitée.
   * Renvoie l'issue (recalibré ou non) — Stella s'en sert pour composer sa
   * réponse, le bouton "Recalibrer maintenant" l'ignore (le toast suffit).
   */
  const recalibrateNow = useCallback(async (): Promise<{ recalibrated: boolean; throughWeekNumber?: number }> => {
    if (!activePlan) return { recalibrated: false }
    const dueThroughWeek = weekNeedsRecalibration(activePlan.weeks, activePlan.recalibrations?.at(-1)?.throughWeekNumber, todayId)
    if (dueThroughWeek == null) {
      toast({ title: 'Rien à recalibrer', description: 'Le plan est déjà à jour par rapport aux semaines terminées.' })
      return { recalibrated: false }
    }
    await runRecalibration(activePlan, dueThroughWeek)
    toast({ title: 'Plan recalibré', description: `Semaines ajustées suite au bilan de la semaine ${dueThroughWeek}.` })
    return { recalibrated: true, throughWeekNumber: dueThroughWeek }
  }, [activePlan, todayId, runRecalibration, toast])

  return { recalibrateNow, isRecalibrating }
}
