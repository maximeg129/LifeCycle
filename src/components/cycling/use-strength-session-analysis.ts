"use client"

// ── "Analyse complète de la séance de musculation" — déclenchement AUTOMATIQUE
// à la fin d'une séance (chantier "repenser planification/séances/feedback",
// pièce B3, voir CLAUDE.md) ─────────────────────────────────────────────────
//
// Miroir de use-ride-analysis.ts (côté vélo), avec deux différences :
// - `generate()` prend directement l'id ET les données de la séance en
//   paramètre plutôt que de les lire d'un `logId` fixé à l'instanciation du
//   hook : l'id est généré CÔTÉ CLIENT juste avant l'écriture Firestore
//   (`doc(collection(...))`, même patron que use-ride-analysis) et les
//   données du log sont déjà en main à l'appelant (LiveStrengthSessionView/
//   LogStrengthSessionDialog viennent de les construire) — pas besoin
//   d'attendre un aller-retour Firestore pour les relire.
// - Le résultat déclenche EN PLUS une notification push (via
//   /api/notifications/send, seul pont possible vers l'Admin SDK côté
//   serveur — voir ce fichier) : l'analyse peut finir après que l'athlète a
//   fermé l'app (LiveStrengthSessionView appelle generate() sans l'attendre,
//   juste avant onClose()), la notification est la seule façon de le savoir.
//   Best-effort — un échec d'envoi ne remonte jamais à l'appelant, comme
//   push-notifications.ts lui-même.
//
// `logId: null` tant qu'aucune analyse précise n'est en cours de lecture —
// couvre le cas d'usage "déclencheur only" (LiveStrengthSessionView n'a pas
// besoin de lire un doc, juste d'appeler generate()) sans jamais souscrire à
// un listener Firestore superflu.

import { useCallback, useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { usePowerCurve } from './use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { fitCriticalPower } from '@/domain/cycling/metrics/criticalPower'
import { buildCoachContext } from './coach-context'
import { useStrengthLogs } from './use-strength-logs'
import { strengthSessionAnalysis, type StrengthSessionAnalysisOutput } from '@/ai/flows/strength-session-analysis-flow'
import { exerciseHistory, totalWeightLiftedKg, type LoggedExercise, type StrengthSessionLog } from './strength-log-types'
import { describeActionDispatchError } from '@/lib/utils'
import { format } from 'date-fns'

interface StoredStrengthSessionAnalysis {
  userId: string
  analysis: StrengthSessionAnalysisOutput
}

/**
 * Envoie une notification push best-effort via l'Admin SDK côté serveur —
 * jamais bloquant pour l'appelant (voir push-notifications.ts). Nécessite le
 * jeton Firebase Auth du client (voir /api/notifications/send/route.ts, qui
 * vérifie ce jeton avant d'envoyer quoi que ce soit — jamais un uid pris en
 * clair côté serveur).
 */
async function notifyAnalysisReady(idToken: string, title: string): Promise<void> {
  try {
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        title: 'Analyse de séance prête',
        body: title,
        url: '/coach?tab=journal',
      }),
    })
  } catch {
    // Best-effort — une notification qui échoue ne doit jamais faire
    // échouer l'analyse elle-même, déjà persistée avant cet appel.
  }
}

/** logId: passer null tant qu'aucune analyse précise n'est à lire (voir l'en-tête). */
export function useStrengthSessionAnalysis(logId: string | null) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status, athlete.data?.weight)
  const powerCurve = usePowerCurve()
  const powerRecords = [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  const enduranceIndex = fitEnduranceCurve(powerRecords)?.enduranceIndex ?? null
  const criticalPowerModel = fitCriticalPower(powerRecords)
  const { logs: pastLogs } = useStrengthLogs()

  const analysisRef = useMemoFirebase(() => {
    if (!user || !db || !logId) return null
    return doc(db, `users/${user.uid}/strengthSessionAnalyses/${logId}`)
  }, [db, user, logId])
  const { data: stored, isLoading: isLoadingStored } = useDoc<StoredStrengthSessionAnalysis>(analysisRef)

  const [isGenerating, setIsGenerating] = useState(false)

  const generate = useCallback(async (targetLogId: string, log: StrengthSessionLog): Promise<boolean> => {
    if (!user || !db) return false
    setIsGenerating(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      const exercises = log.exercises.map((ex: LoggedExercise) => {
        const history = exerciseHistory(pastLogs, ex.name)
        const previous = history.at(-1)
        const isPersonalRecord = !!(ex.loadKg != null && previous?.loadKg != null && ex.loadKg > previous.loadKg)
        return {
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          loadKg: ex.loadKg,
          notes: ex.notes,
          setsDetail: ex.setsDetail,
          previousBest: previous ? { date: previous.date, sets: previous.sets, reps: previous.reps, loadKg: previous.loadKg } : undefined,
          isPersonalRecord,
        }
      })

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

      const result = await strengthSessionAnalysis({
        session: {
          date: log.date,
          title: log.title,
          durationMinutes: log.durationSeconds != null ? Math.round(log.durationSeconds / 60) : undefined,
          totalWeightLiftedKg: totalWeightLiftedKg(log.exercises) || undefined,
          sessionRpe: log.sessionRpe,
          sessionNotes: log.sessionNotes,
        },
        exercises,
        athlete: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
        } : undefined,
        coachContext,
      })

      if (!result.ok) {
        console.error('[useStrengthSessionAnalysis] flow failed:', result.error)
        return false
      }

      const ref = doc(db, `users/${user.uid}/strengthSessionAnalyses/${targetLogId}`)
      const data = { userId: user.uid, analysis: result.data, createdAt: serverTimestamp() }
      try {
        await setDoc(ref, data)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data }))
        return false
      }

      // Notification best-effort — voir notifyAnalysisReady ci-dessus.
      // Silencieusement omise sans jeton Firebase Auth valide (ne devrait
      // pas arriver ici puisque `user` est déjà vérifié non-null, mais
      // getIdToken() reste un appel réseau qui peut échouer).
      try {
        const idToken = await user.getIdToken()
        await notifyAnalysisReady(idToken, `${log.title} — analyse prête`)
      } catch {
        // Best-effort, voir ci-dessus.
      }

      return true
    } catch (e) {
      console.error('[useStrengthSessionAnalysis] failed:', describeActionDispatchError(e))
      return false
    } finally {
      setIsGenerating(false)
    }
  }, [user, db, pastLogs, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, athlete.data, athlete.isConfigured])

  /** Régénère manuellement l'analyse d'une séance déjà loguée — même flow, avec un toast (contrairement au déclenchement automatique, silencieux). Pour l'affichage dans le Journal. */
  const regenerate = useCallback(async (targetLogId: string, log: StrengthSessionLog): Promise<boolean> => {
    const ok = await generate(targetLogId, log)
    if (!ok) toast({ variant: 'destructive', title: "L'IA n'a pas pu analyser la séance" })
    return ok
  }, [generate, toast])

  return {
    analysis: stored?.analysis ?? null,
    isLoadingStored,
    isGenerating,
    generate,
    regenerate,
  }
}
