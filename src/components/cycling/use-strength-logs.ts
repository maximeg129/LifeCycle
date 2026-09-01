"use client"

// Suivi détaillé des séances de musculation (retour utilisateur : "suivi
// détaillé par exercice") — lecture temps réel uniquement, même patron que
// use-session-feedback.ts. L'écriture elle-même vit dans le dialogue
// appelant (LogStrengthSessionDialog), via useCrudSubmit — pas ici, voir
// CLAUDE.md section "Dialogues CRUD".

import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import type { StrengthSessionLogWithId } from './strength-log-types'

export function useStrengthLogs() {
  const { user } = useUser()
  const db = useFirestore()

  const logsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/strengthSessionLogs`), orderBy('date', 'desc'))
  }, [db, user])
  const { data, isLoading } = useCollection<StrengthSessionLogWithId>(logsQuery)

  return { logs: data ?? [], isLoading }
}
