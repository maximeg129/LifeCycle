"use client"

import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import type { SessionFeedback } from './session-feedback-types'

export function useSessionFeedback() {
  const { user } = useUser()
  const db = useFirestore()

  const feedbackQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/sessionFeedback`), orderBy('date', 'desc'))
  }, [db, user])
  const { data, isLoading } = useCollection<SessionFeedback>(feedbackQuery)

  return { feedback: data || [], isLoading }
}
