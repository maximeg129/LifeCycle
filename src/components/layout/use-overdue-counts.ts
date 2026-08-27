"use client"

import { useMemo } from 'react'
import { collection, doc, query, where } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import { getDaysUntilWatering, type PlantLike } from '@/components/home-management/plant-types'

interface TaskLike {
  isActive?: boolean
  nextDueDate?: { seconds: number } | null
}

interface NotificationPrefs {
  tasksReminders?: boolean
  plantsReminders?: boolean
}

/** Overdue counts for the sidebar badges — respects the user's notification prefs. */
export function useOverdueCounts() {
  const { user } = useUser()
  const db = useFirestore()

  const prefsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/notifications`)
  }, [db, user])
  const { data: prefs } = useDoc<NotificationPrefs>(prefsRef)

  const tasksQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/tasks`), where('isActive', '==', true))
  }, [db, user])
  const { data: tasks } = useCollection<TaskLike>(tasksQuery)

  const plantsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/plants`)
  }, [db, user])
  const { data: plants } = useCollection<PlantLike>(plantsQuery)

  return useMemo(() => {
    const tasksEnabled = prefs?.tasksReminders ?? true
    const plantsEnabled = prefs?.plantsReminders ?? true
    const now = Date.now()

    const overdueTasks = tasksEnabled
      ? (tasks || []).filter((t) => t.nextDueDate?.seconds && t.nextDueDate.seconds * 1000 <= now).length
      : 0
    const overduePlants = plantsEnabled
      ? (plants || []).filter((p) => getDaysUntilWatering(p) < 0).length
      : 0

    return { overdueTasks, overduePlants }
  }, [tasks, plants, prefs])
}
