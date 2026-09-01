"use client"

// Préférence de l'athlète : inclure ou non des séances de musculation dans
// le plan d'entraînement, et le volume hebdo qui leur est dédié. Même
// patron "un doc singleton par préoccupation" que users/{uid}/settings/
// biometrics ou settings/powerCurve — aucune règle Firestore dédiée
// nécessaire, firestore.rules couvre déjà tout users/{uid}/settings/{id}.
//
// Source de vérité UNIQUE pour deux mécanismes déclencheurs distincts
// (retour utilisateur : "les deux") : le formulaire de création de plan
// (training-plan-tab.tsx) lit/écrit ce doc directement, et le futur outil
// Stella (coach-chat-flow.ts) écrira dans ce même doc plutôt que de
// modifier un plan directement — Stella ne génère jamais un plan elle-même
// (voir CLAUDE.md, section coachChat), elle ne fait qu'ajuster la
// préférence que la PROCHAINE génération/régénération de plan appliquera.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export interface TrainingPreferencesDoc {
  includeStrengthTraining?: boolean
  strengthWeeklyMinutes?: number
  updatedAt?: unknown
}

export function useTrainingPreferences() {
  const { user } = useUser()
  const db = useFirestore()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/trainingPreferences`)
  }, [db, user])
  const { data, isLoading } = useDoc<TrainingPreferencesDoc>(ref)

  const setPreferences = async (patch: Partial<Omit<TrainingPreferencesDoc, 'updatedAt'>>) => {
    if (!ref) return
    const payload = { ...patch, updatedAt: serverTimestamp() }
    try {
      await setDoc(ref, payload, { merge: true })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: payload }))
    }
  }

  return { data: data ?? null, isLoading, setPreferences }
}
