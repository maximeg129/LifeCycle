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

import { useCallback, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, orderBy, setDoc, deleteDoc, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useAthlete } from '@/hooks/use-intervals'
import { useCoachMemory } from './use-coach-memory'
import { useGovernor } from './use-governor'
import { useKJBudget } from './use-kj-budget'
import { buildCoachContext } from './coach-context'
import { coachChat, type CoachChatMessage } from '@/ai/flows/coach-chat-flow'
import { trimChatHistoryForPrompt, isSendableChatMessage } from './coach-chat-types'
import { currentPlanWeek, type PlanWeek } from './training-plan-types'
import { format } from 'date-fns'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'

interface StoredChatMessage extends CoachChatMessage {
  userId: string
  createdAt: Timestamp
}

export function useCoachChat() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status)
  const lifestyle = useLifestyleData()

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/coachChatMessages`), orderBy('createdAt', 'asc'))
  }, [db, user])
  const { data: messages, isLoading: isLoadingHistory } = useCollection<StoredChatMessage>(messagesQuery)

  const activePlanQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/trainingPlans`), where('status', '==', 'active'))
  }, [db, user])
  const { data: activePlans } = useCollection<{ weeks: PlanWeek[] }>(activePlanQuery)
  const planWeek = useMemo(() => {
    const plan = activePlans?.[0]
    const today = format(new Date(), 'yyyy-MM-dd')
    return plan ? currentPlanWeek(plan.weeks, today) : null
  }, [activePlans])

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
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline },
        governorStatus: governor.status,
      })

      const history = trimChatHistoryForPrompt([...(messages ?? []), userMessage])

      const reply = await coachChat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        coachContext,
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
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
      })

      const assistantRef = doc(collection(db, `users/${user.uid}/coachChatMessages`))
      const assistantData = { role: 'assistant' as const, content: reply, userId: user.uid, createdAt: serverTimestamp() }
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
  }, [user, db, memory.injuries, memory.lifestyle, memory.goals, memory.rememberedFacts, budget.realized, budget.target, budget.baseline, governor.status, athlete.isConfigured, athlete.data, planWeek, lifestyle.latest, lifestyle.readiness, messages, toast])

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
