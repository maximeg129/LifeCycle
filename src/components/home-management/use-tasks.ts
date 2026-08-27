"use client"

import { useCallback, useMemo } from 'react'
import { collection, doc, setDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { computeNextDueDate, sortByDueDate, type TaskLike } from './task-types'

export interface Task extends TaskLike {
  id: string
  name: string
  room: string
  description?: string
  estimatedMinutes: number
  priority: 'low' | 'medium' | 'high'
  isActive: boolean
}

export interface NewTaskInput {
  name: string
  room: string
  priority: 'low' | 'medium' | 'high'
  estimatedMinutes: number
  recurrenceDays: number
}

export function useTasks() {
  const { user } = useUser()
  const db = useFirestore()

  const tasksQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/tasks`), where('isActive', '==', true))
  }, [db, user])
  const { data, isLoading } = useCollection<Task>(tasksQuery)

  const tasks = useMemo(() => sortByDueDate(data || []), [data])

  const addTask = useCallback(async (input: NewTaskInput) => {
    if (!user || !db) return
    const nextDueDate = computeNextDueDate(input.recurrenceDays)
    const taskRef = doc(collection(db, `users/${user.uid}/tasks`))
    const newTask = {
      name: input.name,
      room: input.room,
      description: '',
      estimatedMinutes: input.estimatedMinutes,
      recurrenceDays: input.recurrenceDays,
      priority: input.priority,
      nextDueDate: Timestamp.fromDate(nextDueDate),
      isActive: true,
      createdAt: serverTimestamp(),
      userId: user.uid,
    }
    await setDoc(taskRef, newTask).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: taskRef.path, operation: 'create', requestResourceData: newTask }))
      throw new Error('permission-denied')
    })
    return nextDueDate
  }, [user, db])

  const markDone = useCallback(async (task: Task) => {
    if (!user || !db) return
    const nextDue = computeNextDueDate(task.recurrenceDays ?? 7)
    const taskRef = doc(db, `users/${user.uid}/tasks`, task.id)
    const update = { lastCompleted: serverTimestamp(), nextDueDate: Timestamp.fromDate(nextDue) }
    await setDoc(taskRef, update, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: taskRef.path, operation: 'update', requestResourceData: update }))
      throw new Error('permission-denied')
    })
    return nextDue
  }, [user, db])

  return { tasks, isLoading, addTask, markDone }
}
