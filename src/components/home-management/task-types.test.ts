import { describe, it, expect } from 'vitest'
import { computeNextDueDate, isTaskOverdue, daysUntilDue, sortByDueDate } from './task-types'

const NOW = new Date('2026-08-27T12:00:00')
const secondsAt = (d: string) => Math.floor(new Date(d).getTime() / 1000)

describe('computeNextDueDate', () => {
  it('adds the recurrence in days to the given date', () => {
    const from = new Date('2026-08-27T00:00:00')
    expect(computeNextDueDate(7, from)).toEqual(new Date('2026-09-03T00:00:00'))
  })

  it('defaults to 7 days when recurrenceDays is 0/falsy', () => {
    const from = new Date('2026-08-27T00:00:00')
    expect(computeNextDueDate(0, from)).toEqual(new Date('2026-09-03T00:00:00'))
  })
})

describe('isTaskOverdue', () => {
  it('is false when there is no due date', () => {
    expect(isTaskOverdue({}, NOW)).toBe(false)
  })

  it('is true once the due date has passed', () => {
    expect(isTaskOverdue({ nextDueDate: { seconds: secondsAt('2026-08-20T00:00:00') } }, NOW)).toBe(true)
  })

  it('is false while the due date is still in the future', () => {
    expect(isTaskOverdue({ nextDueDate: { seconds: secondsAt('2026-09-01T00:00:00') } }, NOW)).toBe(false)
  })
})

describe('daysUntilDue', () => {
  it('returns null when there is no due date', () => {
    expect(daysUntilDue({}, NOW)).toBeNull()
  })

  it('returns a negative count once overdue', () => {
    expect(daysUntilDue({ nextDueDate: { seconds: secondsAt('2026-08-20T12:00:00') } }, NOW)).toBe(-7)
  })

  it('returns a positive count for a future due date', () => {
    expect(daysUntilDue({ nextDueDate: { seconds: secondsAt('2026-09-01T12:00:00') } }, NOW)).toBe(5)
  })
})

describe('sortByDueDate', () => {
  it('sorts nearest due date first', () => {
    const tasks = [
      { id: 'far', nextDueDate: { seconds: secondsAt('2026-09-10T00:00:00') } },
      { id: 'near', nextDueDate: { seconds: secondsAt('2026-08-28T00:00:00') } },
    ]
    expect(sortByDueDate(tasks).map((t) => t.id)).toEqual(['near', 'far'])
  })

  it('sorts tasks with no due date last, not first', () => {
    // Regression: the original inline sort used `|| 0` for a missing due
    // date, which put undated tasks at the very front (most "urgent")
    // instead of the back.
    const tasks = [
      { id: 'undated' },
      { id: 'dated', nextDueDate: { seconds: secondsAt('2026-08-28T00:00:00') } },
    ]
    expect(sortByDueDate(tasks).map((t) => t.id)).toEqual(['dated', 'undated'])
  })

  it('does not mutate the input array', () => {
    const tasks = [{ id: 'a', nextDueDate: { seconds: 2 } }, { id: 'b', nextDueDate: { seconds: 1 } }]
    const original = [...tasks]
    sortByDueDate(tasks)
    expect(tasks).toEqual(original)
  })
})
