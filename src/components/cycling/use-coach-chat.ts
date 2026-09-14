"use client"

// ── "Stella" coach chat — glue between the AI flow, Coach Memory, and
// Firestore ──────────────────────────────────────────────────────────
//
// A single ongoing conversation per user (no threads) — coachChatMessages
// is a flat, append-only, chronologically-ordered log. Same context
// sources as the other coach features (buildCoachContext, current
// CTL/ATL/TSB, active plan's current week, last night's sleep/HRV/readiness
// via useLifestyleData) so Stella isn't a second, disconnected notion of
// the athlete.
//
// Stella's tool calls (update_goal, add_goal, add_remembered_fact,
// update_injury_status — see coach-chat-flow.ts) can't be executed by the
// flow itself: it runs server-side with no authenticated Firestore client.
// executeToolCall() below is the actual write, mirroring the same
// setDoc/updateDoc/arrayUnion patterns coach-memory-tab.tsx uses for the
// same collections. runToolLoop() calls coachChat(), and whenever it comes
// back as a tool_use result, executes the calls and re-invokes coachChat()
// with the results (pendingToolRound) until Claude produces final text —
// capped so a misbehaving loop can't hang the UI forever.

import { useCallback, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, orderBy, setDoc, updateDoc, deleteDoc, arrayUnion, serverTimestamp, Timestamp, where, type Firestore } from 'firebase/firestore'
import { format } from 'date-fns'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete, useActivities } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { usePowerCurve } from './use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { fitCriticalPower } from '@/domain/cycling/metrics/criticalPower'
import { buildCoachContext } from './coach-context'
import { coachChat, type CoachChatMessage, type CoachChatToolCall } from '@/ai/flows/coach-chat-flow'
import { describeActionDispatchError } from '@/lib/utils'
import { trimChatHistoryForPrompt, isSendableChatMessage } from './coach-chat-types'
import { currentPlanWeek, type PlanWeek } from './training-plan-types'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { useRecalibratePlan, type PlanRecalibrationEntry } from './use-recalibrate-plan'

/** Sous-ensemble du plan actif lu ici — voir CLAUDE.md "Stella ajuste le plan" : set_weekly_availability n'écrit jamais dans un plan directement (même restraint que set_strength_training_preference), mais recalibrate_plan a besoin de la forme complète attendue par useRecalibratePlan. */
interface ActivePlanForChat {
  weeks: PlanWeek[]
  /** yyyy-MM-dd — borne de départ pour fetch les activités réelles du plan (voir planActivities ci-dessous), même usage que use-training-plan.ts. */
  startDate: string
  eventName: string
  eventDate: string
  targetOutcome?: string
  recalibrations?: PlanRecalibrationEntry[]
}

interface StoredChatMessage extends CoachChatMessage {
  userId: string
  createdAt: Timestamp
}

interface ToolResult {
  toolUseId: string
  content: string
  isError?: boolean
}

/** One human-readable line per successfully-executed tool call, for a toast confirming what Stella actually changed. */
function describeToolCall(call: CoachChatToolCall): string {
  switch (call.name) {
    case 'update_goal': return 'Objectif mis à jour'
    case 'add_goal': return 'Objectif ajouté'
    case 'add_remembered_fact': return 'Fait ajouté à la mémoire'
    case 'update_injury_status': return 'Statut de blessure mis à jour'
    case 'set_strength_training_preference': return 'Préférence musculation mise à jour'
    case 'set_weekly_availability': return 'Disponibilité mise à jour'
    // Volontairement générique — "recalibré" affirmerait un changement même
    // quand recalibrateNow() n'avait rien à faire (voir son propre contenu
    // de résultat, qui reste lui honnête sur ce point auprès de Stella).
    case 'recalibrate_plan': return 'Recalibration vérifiée'
    default: return call.name
  }
}

const MAX_TOOL_ROUNDS = 4

interface ToolContext {
  /** Voir use-recalibrate-plan.ts — retourne { recalibrated, throughWeekNumber } plutôt que de lever, pour que le tool_result reste honnête même quand rien n'était dû. */
  recalibrateNow: () => Promise<{ recalibrated: boolean; throughWeekNumber?: number }>
}

async function executeToolCall(db: Firestore, uid: string, call: CoachChatToolCall, ctx: ToolContext): Promise<ToolResult> {
  try {
    switch (call.name) {
      case 'update_goal': {
        const { goalId, ...rest } = call.input as { goalId?: string; eventName?: string; eventDate?: string; targetOutcome?: string; priority?: number }
        if (!goalId) throw new Error('goalId manquant')
        const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
        if (Object.keys(patch).length === 0) throw new Error('Aucun champ à mettre à jour')
        const ref = doc(db, `users/${uid}/coachGoals/${goalId}`)
        await updateDoc(ref, patch)
        return { toolUseId: call.id, content: 'Objectif mis à jour avec succès.' }
      }
      case 'add_goal': {
        const { eventName, eventDate, targetOutcome, priority } = call.input as { eventName: string; eventDate: string; targetOutcome: string; priority: number }
        const ref = doc(collection(db, `users/${uid}/coachGoals`))
        await setDoc(ref, { userId: uid, eventName, eventDate, targetOutcome, priority, createdAt: serverTimestamp() })
        return { toolUseId: call.id, content: 'Nouvel objectif ajouté avec succès.' }
      }
      case 'add_remembered_fact': {
        const { fact } = call.input as { fact: string }
        if (!fact?.trim()) throw new Error('fact manquant')
        const ref = doc(db, `users/${uid}/coachMemory/facts`)
        await setDoc(ref, { items: arrayUnion(fact.trim()), updatedAt: serverTimestamp() }, { merge: true })
        return { toolUseId: call.id, content: 'Fait ajouté à la mémoire coach avec succès.' }
      }
      case 'update_injury_status': {
        const { injuryId, status } = call.input as { injuryId?: string; status?: 'active' | 'resolved' }
        if (!injuryId || !status) throw new Error('injuryId ou status manquant')
        const ref = doc(db, `users/${uid}/coachInjuries/${injuryId}`)
        await updateDoc(ref, { status })
        return { toolUseId: call.id, content: 'Statut de la blessure mis à jour avec succès.' }
      }
      case 'set_strength_training_preference': {
        // Même doc/patron que le toggle manuel de training-plan-tab.tsx
        // (use-training-preferences.ts) — Stella écrit dans la MÊME
        // préférence partagée, jamais dans un plan directement (elle ne
        // génère aucun plan elle-même, voir le prompt système du flow).
        const { includeStrengthTraining, strengthWeeklyMinutes } = call.input as { includeStrengthTraining?: boolean; strengthWeeklyMinutes?: number }
        if (includeStrengthTraining == null) throw new Error('includeStrengthTraining manquant')
        const patch: Record<string, unknown> = { includeStrengthTraining, updatedAt: serverTimestamp() }
        if (strengthWeeklyMinutes != null) patch.strengthWeeklyMinutes = strengthWeeklyMinutes
        const ref = doc(db, `users/${uid}/settings/trainingPreferences`)
        await setDoc(ref, patch, { merge: true })
        return { toolUseId: call.id, content: 'Préférence musculation mise à jour avec succès — sera appliquée à la prochaine génération de plan.' }
      }
      case 'set_weekly_availability': {
        // Même patron/même restraint que set_strength_training_preference
        // juste au-dessus (voir aussi son propre commentaire de fichier,
        // use-training-preferences.ts) : écrit UNIQUEMENT la préférence,
        // jamais un plan directement — Stella ne régénère aucune semaine
        // elle-même.
        const input = call.input as Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', number | undefined>
        const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
        if (order.some((k) => typeof input[k] !== 'number')) throw new Error('Les 7 jours (monday à sunday) sont requis')
        const weeklyAvailabilityMinutes = order.map((k) => input[k] as number)
        const ref = doc(db, `users/${uid}/settings/trainingPreferences`)
        await setDoc(ref, { weeklyAvailabilityMinutes, updatedAt: serverTimestamp() }, { merge: true })
        return { toolUseId: call.id, content: 'Disponibilité hebdomadaire mise à jour avec succès — sera appliquée à la prochaine génération/régénération de la semaine.' }
      }
      case 'recalibrate_plan': {
        // Contrairement aux autres outils, une vraie action IA (pas une
        // simple écriture Firestore) — voir use-recalibrate-plan.ts,
        // réutilisé tel quel (même chemin que le bouton "Recalibrer
        // maintenant" de l'onglet Aujourd'hui), jamais une deuxième
        // logique de recalibration dupliquée ici.
        const { recalibrated, throughWeekNumber } = await ctx.recalibrateNow()
        return {
          toolUseId: call.id,
          content: recalibrated
            ? `Plan recalibré avec succès, suite au bilan de la semaine ${throughWeekNumber}.`
            : 'Rien à recalibrer pour le moment : soit aucun plan actif, soit le plan est déjà à jour par rapport aux semaines terminées.',
        }
      }
      default:
        return { toolUseId: call.id, content: `Outil inconnu : ${call.name}`, isError: true }
    }
  } catch (e) {
    const path = `users/${uid}/${call.name}`
    errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'update', requestResourceData: call.input }))
    return { toolUseId: call.id, content: e instanceof Error ? e.message : 'Erreur inconnue', isError: true }
  }
}

export function useCoachChat() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status, athlete.data?.weight)
  const lifestyle = useLifestyleData()
  const powerCurve = usePowerCurve()
  const powerRecords = [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  const enduranceIndex = fitEnduranceCurve(powerRecords)?.enduranceIndex ?? null
  const criticalPowerModel = fitCriticalPower(powerRecords)

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/coachChatMessages`), orderBy('createdAt', 'asc'))
  }, [db, user])
  const { data: messages, isLoading: isLoadingHistory } = useCollection<StoredChatMessage>(messagesQuery)

  const activePlanQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans, isLoading: isLoadingPlan } = useCollection<ActivePlanForChat>(activePlanQuery)
  const activePlan = activePlans?.[0] ?? null
  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const planWeek = useMemo(() => (activePlan ? currentPlanWeek(activePlan.weeks, todayId) : null), [activePlan, todayId])

  // Retour utilisateur : "l'utilisateur devrait pouvoir... ajuster son plan
  // simplement avec les discussions de Stella" — recalibrate_plan (voir
  // coach-chat-flow.ts) a besoin du même chemin que le bouton "Recalibrer
  // maintenant" (use-recalibrate-plan.ts, extrait de use-training-plan.ts
  // pour ce partage). planActivities : activités réelles sur toute la
  // durée du plan, seulement pour le volume réellement réalisé par semaine
  // — même fetch que l'onglet Aujourd'hui, pas dupliqué en logique.
  const planActivities = useActivities(activePlan?.startDate ?? todayId, todayId)
  const { recalibrateNow } = useRecalibratePlan({
    user, db, activePlan, isLoadingPlan, planActivities, todayId, memory, budget, governor, enduranceIndex, criticalPowerModel, athlete,
    // Jamais automatique ici, contrairement à l'onglet Aujourd'hui (son
    // autre appelant) : Stella ne doit recalibrer QUE sur demande
    // explicite de l'athlète dans la conversation, jamais silencieusement
    // à la simple ouverture du chat.
    autoTrigger: false,
  })

  const [isSending, setIsSending] = useState(false)

  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!user || !db || !isSendableChatMessage(text)) return false
    setIsSending(true)
    try {
      const userMessage: CoachChatMessage = { role: 'user', content: text.trim() }
      const userRef = doc(collection(db, `users/${user.uid}/coachChatMessages`))
      const userData = { ...userMessage, userId: user.uid, createdAt: serverTimestamp() }
      try {
        await setDoc(userRef, userData)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'create', requestResourceData: userData }))
        return false
      }

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

      const history = trimChatHistoryForPrompt([...(messages ?? []), userMessage])
      const baseInput = {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        coachContext,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          ftp: athlete.data.ftp,
          weightKg: athlete.data.weight,
        } : undefined,
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
        availableGoals: memory.goals.map((g) => ({ id: g.id, eventName: g.eventName, eventDate: g.eventDate, targetOutcome: g.targetOutcome, priority: g.priority })),
        availableInjuries: memory.injuries.map((i) => ({ id: i.id, bodyRegion: i.bodyRegion, status: i.status })),
      }

      let pendingToolRound: { assistantContent: Record<string, unknown>[]; toolResults: ToolResult[] } | undefined
      let finalText: string | null = null
      const executedActions: string[] = []

      for (let round = 0; round < MAX_TOOL_ROUNDS && finalText === null; round++) {
        const result = await coachChat({ ...baseInput, pendingToolRound })
        if (!result.ok) {
          toast({ variant: 'destructive', title: "Stella n'a pas pu répondre", description: describeActionDispatchError(new Error(result.error)) })
          return false
        }
        if (result.data.type === 'text') {
          finalText = result.data.text
          break
        }
        const toolResults = await Promise.all(result.data.calls.map((call) => executeToolCall(db, user.uid, call, { recalibrateNow })))
        for (let i = 0; i < result.data.calls.length; i++) {
          if (!toolResults[i].isError) executedActions.push(describeToolCall(result.data.calls[i]))
        }
        pendingToolRound = {
          assistantContent: result.data.assistantContent as unknown as Record<string, unknown>[],
          toolResults,
        }
      }

      if (executedActions.length > 0) {
        toast({ title: 'Mémoire coach mise à jour', description: executedActions.join(' · ') })
      }
      if (finalText === null) finalText = "Désolée, je n'ai pas réussi à terminer cette action — réessaie en reformulant."

      const assistantRef = doc(collection(db, `users/${user.uid}/coachChatMessages`))
      const assistantData = { role: 'assistant' as const, content: finalText, userId: user.uid, createdAt: serverTimestamp() }
      try {
        await setDoc(assistantRef, assistantData)
      } catch {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: assistantRef.path, operation: 'create', requestResourceData: assistantData }))
      }

      return true
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "Stella n'a pas pu répondre." })
      return false
    } finally {
      setIsSending(false)
    }
  }, [user, db, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, budget.trend, budget.exceedsThresholdKJPerKg, governor.status, governor.trainingLoad, enduranceIndex, criticalPowerModel, todayId, athlete.isConfigured, athlete.data, planWeek, lifestyle.latest, lifestyle.readiness, messages, toast, recalibrateNow])

  const clearHistory = useCallback(async () => {
    if (!user || !db) return
    const snap = await getDocs(collection(db, `users/${user.uid}/coachChatMessages`))
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: d.ref.path, operation: 'delete' }))
    })))
  }, [user, db])

  return {
    messages: messages ?? [],
    isLoadingHistory,
    isSending,
    sendMessage,
    clearHistory,
  }
}
