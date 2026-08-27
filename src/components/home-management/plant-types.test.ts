import { describe, it, expect } from 'vitest'
import { getDaysUntilWatering, getHealthColor, getHealthLabel, getHealthStatus, isAnalysisOverdue } from './plant-types'

const NOW = new Date('2026-08-27T12:00:00')
const secondsAt = (d: string) => Math.floor(new Date(d).getTime() / 1000)

describe('getDaysUntilWatering', () => {
  it('is negative (overdue) when never watered', () => {
    expect(getDaysUntilWatering({ wateringFrequencyDays: 7 }, NOW)).toBe(-7)
  })

  it('counts down to the next watering date', () => {
    const plant = { lastWateringDate: { seconds: secondsAt('2026-08-25T12:00:00') }, wateringFrequencyDays: 7 }
    // watered 2 days ago, frequency 7 -> due in 5 days
    expect(getDaysUntilWatering(plant, NOW)).toBe(5)
  })

  it('is negative once the watering window has passed', () => {
    const plant = { lastWateringDate: { seconds: secondsAt('2026-08-10T12:00:00') }, wateringFrequencyDays: 7 }
    expect(getDaysUntilWatering(plant, NOW)).toBeLessThan(0)
  })

  it('defaults frequency to 7 days when unset', () => {
    const plant = { lastWateringDate: { seconds: secondsAt('2026-08-27T12:00:00') } }
    expect(getDaysUntilWatering(plant, NOW)).toBe(7)
  })
})

describe('getHealthColor / getHealthLabel / getHealthStatus', () => {
  it('classifies a healthy score', () => {
    expect(getHealthColor(90)).toBe('text-green-500')
    expect(getHealthLabel(90)).toBe('Saine')
    expect(getHealthStatus(90)).toBe('green')
  })

  it('classifies a score needing attention', () => {
    expect(getHealthColor(60)).toBe('text-orange-400')
    expect(getHealthLabel(60)).toBe('Surveiller')
    expect(getHealthStatus(60)).toBe('yellow')
  })

  it('classifies a critical score', () => {
    expect(getHealthColor(20)).toBe('text-red-500')
    expect(getHealthLabel(20)).toBe('Critique')
    expect(getHealthStatus(20)).toBe('red')
  })

  it('treats the 75/50 boundaries as inclusive of the better tier', () => {
    expect(getHealthStatus(75)).toBe('green')
    expect(getHealthStatus(50)).toBe('yellow')
  })
})

describe('isAnalysisOverdue', () => {
  it('is overdue when never analyzed', () => {
    expect(isAnalysisOverdue({}, NOW)).toBe(true)
  })

  it('is not overdue just after an analysis', () => {
    const plant = { lastAnalysisDate: { seconds: secondsAt('2026-08-20T12:00:00') } }
    expect(isAnalysisOverdue(plant, NOW)).toBe(false)
  })

  it('is overdue once 30 days have passed', () => {
    const plant = { lastAnalysisDate: { seconds: secondsAt('2026-07-20T12:00:00') } }
    expect(isAnalysisOverdue(plant, NOW)).toBe(true)
  })
})
