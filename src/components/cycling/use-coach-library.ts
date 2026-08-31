"use client"

import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import type { LibrarySourceType } from './library-types'

export interface LibraryEntry {
  id: string
  userId: string
  title: string
  authors?: string
  sourceType: LibrarySourceType
  url?: string
  tags: string[]
  summary: string
  /** Full text, pasted or extracted from an uploaded PDF (see /api/library/extract-pdf) — optional, never sent to an AI flow automatically (see coach-context.ts: only `summary` is). */
  fullText?: string
}

/** Real-time list of the athlete's coach knowledge-base entries (users/{uid}/coachLibrary), newest first. */
export function useCoachLibrary() {
  const { user } = useUser()
  const db = useFirestore()

  const libraryQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/coachLibrary`), orderBy('createdAt', 'desc'))
  }, [db, user])
  const { data: entries, isLoading } = useCollection<LibraryEntry>(libraryQuery)

  return {
    entries: entries || [],
    isLoading,
  }
}
