// ── Recurring household tasks — pure helpers ────────────────────────
//
// Extracted from home-management/page.tsx so the recurrence/overdue logic
// is testable without mocking Firestore, matching the convention used
// elsewhere in the app.

import { addDays, differenceInDays } from 'date-fns'

export interface TaskLike {
  nextDueDate?: { seconds: number } | null
  recurrenceDays?: number
}

/** Next due date after completing a task today, given its recurrence in days. */
export function computeNextDueDate(recurrenceDays: number, from: Date = new Date()): Date {
  return addDays(from, recurrenceDays || 7)
}

/** True once a task's due date has passed. */
export function isTaskOverdue(task: TaskLike, now: Date = new Date()): boolean {
  if (!task.nextDueDate?.seconds) return false
  return task.nextDueDate.seconds * 1000 <= now.getTime()
}

/** Days until a task is due — negative means overdue. Null if the task has no due date. */
export function daysUntilDue(task: TaskLike, now: Date = new Date()): number | null {
  if (!task.nextDueDate?.seconds) return null
  return differenceInDays(new Date(task.nextDueDate.seconds * 1000), now)
}

/** Sorts tasks by nearest due date first — tasks with no due date sort last. */
export function sortByDueDate<T extends TaskLike>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => (a.nextDueDate?.seconds ?? Infinity) - (b.nextDueDate?.seconds ?? Infinity))
}
