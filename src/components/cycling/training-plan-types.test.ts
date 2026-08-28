import { describe, it, expect } from 'vitest'
import {
  clampWeeklyMinutes,
  weeksUntilEvent,
  clampPlanWeeks,
  buildPlanWeekSkeleton,
  mergePlanWeeks,
  currentPlanWeek,
  type PlanWeekContent,
} from './training-plan-types'

describe('clampWeeklyMinutes', () => {
  it('passes through a value already in range', () => {
    expect(clampWeeklyMinutes(600)).toBe(600)
  })

  it('floors to the minimum for a too-small value', () => {
    expect(clampWeeklyMinutes(10)).toBe(60)
  })

  it('caps at the maximum for a very large value', () => {
    expect(clampWeeklyMinutes(5000)).toBe(1500)
  })

  it('falls back to the minimum for NaN', () => {
    expect(clampWeeklyMinutes(NaN)).toBe(60)
  })
})

describe('weeksUntilEvent', () => {
  it('computes whole weeks for an exact multiple of 7 days', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-10-23')).toBe(8)
  })

  it('floors a partial week', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-10-27')).toBe(8)
  })

  it('returns 0 for an event this week', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-08-30')).toBe(0)
  })

  it('returns a negative number for a past event', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-08-01')).toBeLessThan(0)
  })
})

describe('clampPlanWeeks', () => {
  it('passes through a value already in range', () => {
    expect(clampPlanWeeks(12)).toBe(12)
  })

  it('floors to the minimum for a too-small or negative value', () => {
    expect(clampPlanWeeks(1)).toBe(2)
    expect(clampPlanWeeks(-3)).toBe(2)
  })

  it('caps at the maximum for a very large value', () => {
    expect(clampPlanWeeks(52)).toBe(24)
  })
})

describe('buildPlanWeekSkeleton', () => {
  it('aligns the first week to the Monday containing the start date', () => {
    // 2026-08-28 is a Friday
    const weeks = buildPlanWeekSkeleton('2026-08-28', 3)
    expect(weeks[0]).toEqual({ weekNumber: 1, startDate: '2026-08-24', endDate: '2026-08-30' })
  })

  it('produces contiguous, non-overlapping 7-day weeks', () => {
    const weeks = buildPlanWeekSkeleton('2026-08-28', 3)
    expect(weeks).toEqual([
      { weekNumber: 1, startDate: '2026-08-24', endDate: '2026-08-30' },
      { weekNumber: 2, startDate: '2026-08-31', endDate: '2026-09-06' },
      { weekNumber: 3, startDate: '2026-09-07', endDate: '2026-09-13' },
    ])
  })

  it('returns an empty array for zero weeks', () => {
    expect(buildPlanWeekSkeleton('2026-08-28', 0)).toEqual([])
  })
})

describe('mergePlanWeeks', () => {
  const skeleton = buildPlanWeekSkeleton('2026-08-28', 2)
  const content: PlanWeekContent[] = [
    { phase: 'base', focus: 'Endurance', targetWeeklyMinutes: 300 },
    { phase: 'build', focus: 'Seuil', targetWeeklyMinutes: 360, notes: 'Semaine de charge' },
  ]

  it('zips content onto the skeleton by index', () => {
    const weeks = mergePlanWeeks(skeleton, content)
    expect(weeks[0]).toMatchObject({ weekNumber: 1, phase: 'base', focus: 'Endurance', targetWeeklyMinutes: 300 })
    expect(weeks[1]).toMatchObject({ weekNumber: 2, phase: 'build', notes: 'Semaine de charge' })
  })

  it('falls back to safe defaults for a missing week rather than crashing', () => {
    const weeks = mergePlanWeeks(skeleton, [content[0]])
    expect(weeks[1]).toMatchObject({ weekNumber: 2, phase: 'base', focus: '', targetWeeklyMinutes: 0 })
  })

  it('ignores extra content beyond the skeleton length', () => {
    const weeks = mergePlanWeeks(skeleton, [...content, { phase: 'peak', focus: 'extra', targetWeeklyMinutes: 999 }])
    expect(weeks).toHaveLength(2)
  })
})

describe('currentPlanWeek', () => {
  const weeks = mergePlanWeeks(buildPlanWeekSkeleton('2026-08-28', 3), [
    { phase: 'base', focus: 'A', targetWeeklyMinutes: 300 },
    { phase: 'build', focus: 'B', targetWeeklyMinutes: 360 },
    { phase: 'taper', focus: 'C', targetWeeklyMinutes: 180 },
  ])

  it('finds the week containing a given date', () => {
    expect(currentPlanWeek(weeks, '2026-09-01')?.weekNumber).toBe(2)
  })

  it('matches on the exact boundary dates', () => {
    expect(currentPlanWeek(weeks, '2026-08-24')?.weekNumber).toBe(1)
    expect(currentPlanWeek(weeks, '2026-09-13')?.weekNumber).toBe(3)
  })

  it('returns null before the plan starts', () => {
    expect(currentPlanWeek(weeks, '2026-08-01')).toBeNull()
  })

  it('returns null after the plan ends', () => {
    expect(currentPlanWeek(weeks, '2026-12-01')).toBeNull()
  })

  it('returns null for an empty plan', () => {
    expect(currentPlanWeek([], '2026-09-01')).toBeNull()
  })
})
