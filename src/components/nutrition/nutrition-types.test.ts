import { describe, it, expect } from 'vitest'
import { getDayId, sumMeals, progressPct } from './nutrition-types'

describe('getDayId', () => {
  it('formats yyyy-MM-dd with zero-padding', () => {
    expect(getDayId(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('sumMeals', () => {
  it('sums calories/protein/carbs across meals', () => {
    const meals = [
      { calories: 450, protein: 20, carbs: 60 },
      { calories: 620, protein: 45, carbs: 55 },
    ]
    expect(sumMeals(meals)).toEqual({ calories: 1070, protein: 65, carbs: 115 })
  })

  it('returns all-zero totals for an empty list', () => {
    expect(sumMeals([])).toEqual({ calories: 0, protein: 0, carbs: 0 })
  })

  it('tolerates missing/undefined fields', () => {
    // @ts-expect-error - simulating a partially-filled custom entry
    expect(sumMeals([{ calories: 300 }])).toEqual({ calories: 300, protein: 0, carbs: 0 })
  })
})

describe('progressPct', () => {
  it('computes a percentage of target', () => {
    expect(progressPct(50, 100)).toBe(50)
  })
  it('caps at 100 even when current exceeds target', () => {
    expect(progressPct(150, 100)).toBe(100)
  })
  it('returns 0 when target is 0 or missing', () => {
    expect(progressPct(50, 0)).toBe(0)
  })
})
