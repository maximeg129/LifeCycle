"use client"

// ── Génère les séances type d'une semaine du plan — extrait de
// use-training-plan.ts pour être réutilisable ailleurs.
//
// Jusqu'ici seul useTrainingPlan() (onglet Plan) savait générer
// week.sampleSessions, via un effect local à training-plan-tab.tsx qui
// déclenchait l'auto-génération de la semaine COURANTE à l'ouverture de
// l'onglet. Depuis la séparation Aujourd'hui/Plan en deux onglets (voir
// CLAUDE.md "Aujourd'hui et Plan redéfusionnés"), un athlète qui n'ouvre
// que "Aujourd'hui" ne déclenche plus jamais cette génération — sa
// "séance prévue" reste indéfiniment absente tant qu'il ne visite pas
// l'onglet Plan séparément, symptôme découvert en construisant l'aperçu
// de séance prévue de la page Cyclisme (voir performance-bento.tsx).
//
// Ce hook prend en paramètre les données déjà chargées par l'appelant
// (mémoire coach, budget kJ, gouverneur, indices de puissance, athlète)
// plutôt que de les refetch lui-même — use-training-plan.ts ET
// use-daily-workout.ts les ont chacun DÉJÀ pour leur propre appel IA
// (Plan/Proposition du jour), donc les brancher toutes les deux sur ce
// hook partagé n'introduit aucune lecture Firestore/Intervals.icu
// supplémentaire, seulement une génération réellement déclenchable depuis
// les deux onglets plutôt qu'un seul.

import { useCallback, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { buildCoachContext } from './coach-context'
import { planWeekSessions } from '@/ai/flows/plan-week-sessions-flow'
import { assignSessionDates, type PlanWeek } from './training-plan-types'
import { recentStrengthSessionPatterns } from './strength-session-plan-types'
import { validateStrengthSession } from '@/domain/cycling/validation/strengthSessionValidator'
import { describeActionDispatchError } from '@/lib/utils'
import type { useCoachMemory } from './use-coach-memory'
import type { useKJBudget } from './use-kj-budget'
import type { useGovernor } from './use-governor'
import type { useAthlete } from '@/hooks/use-intervals'
import type { CriticalPowerModel } from '@/domain/cycling/metrics/criticalPower'

interface GenerateWeekSessionsDeps {
  user: User | null | undefined
  db: Firestore | null | undefined
  /** Seuls id/weeks sont lus ici — n'importe quel plan actif chargé par l'appelant (StoredPlan de use-training-plan.ts, ou la forme plus légère de use-daily-workout.ts) satisfait cette forme. */
  activePlan: { id: string; weeks: PlanWeek[] } | null | undefined
  memory: ReturnType<typeof useCoachMemory>
  budget: ReturnType<typeof useKJBudget>
  governor: ReturnType<typeof useGovernor>
  enduranceIndex: number | null
  criticalPowerModel: CriticalPowerModel | null
  athlete: ReturnType<typeof useAthlete>
}

export function useGenerateWeekSessions(deps: GenerateWeekSessionsDeps) {
  const { user, db, activePlan, memory, budget, governor, enduranceIndex, criticalPowerModel, athlete } = deps
  const { toast } = useToast()
  const [generatingSessionsForWeek, setGeneratingSessionsForWeek] = useState<number | null>(null)

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

      // Historique musculation (S05, règle hip-hinge) — calculé une seule
      // fois, réutilisé à la fois pour informer le modèle (recentStrengthPatterns)
      // et pour la validation déterministe post-génération ci-dessous.
      const previousStrengthPatterns = recentStrengthSessionPatterns(activePlan.weeks, week.weekNumber)

      const result = await planWeekSessions({
        weekNumber: week.weekNumber,
        phase: week.phase,
        focus: week.focus,
        targetWeeklyMinutes: week.targetWeeklyMinutes,
        targetStrengthMinutes: week.targetStrengthMinutes,
        recentStrengthPatterns: previousStrengthPatterns,
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

      // Retour utilisateur : "une séance qui ne les respecte pas ne doit
      // jamais être proposée comme séance 'complète'" — vérification
      // déterministe (S05, strengthSessionValidator.ts) attachée à chaque
      // séance de musculation générée, jamais une auto-évaluation du
      // modèle. hoursBeforeNextKeySession reste `null` : les séances de
      // CETTE semaine n'ont pas encore de date à ce stade (assignSessionDates
      // tourne juste après, voir plus bas) et croiser le timing avec une
      // séance clé d'une AUTRE semaine du plan n'est pas câblé — voir
      // checkTimingBeforeKeySession.
      const strengthSessionsThisWeek = result.data.sessions.filter((s) => s.sessionKind === 'strength').length
      const sessionsWithValidation = result.data.sessions.map((session) => {
        if (session.sessionKind !== 'strength' || !session.strengthPhase) return session
        const strengthValidation = validateStrengthSession({
          session: {
            sessionType: session.sessionType ?? 'principale',
            strengthPhase: session.strengthPhase,
            durationMinutes: session.durationMinutes,
            exercises: session.strengthExercises ?? [],
          },
          previousSessionsPatterns: previousStrengthPatterns,
          weeklyCyclingHours: week.targetWeeklyMinutes / 60,
          cyclingPhase: week.phase,
          strengthSessionsThisWeek,
          hoursBeforeNextKeySession: null,
        })
        return { ...session, strengthValidation }
      })

      // Retour utilisateur : "le plan d'entrainement ne devrais t il pas
      // etre figé avec les seances par jour ?" — chaque séance type obtient
      // une date déterministe (jamais confiée à l'IA, voir
      // distributeWeekdayOffsets) dès sa génération, plutôt qu'un
      // sélecteur de date libre non persisté au moment de l'envoi.
      const datedSessions = assignSessionDates(week, sessionsWithValidation)

      const weeks = activePlan.weeks.map((w) =>
        w.weekNumber === week.weekNumber ? { ...w, sampleSessions: datedSessions } : w
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

  return { generateWeekSessions, generatingSessionsForWeek }
}
