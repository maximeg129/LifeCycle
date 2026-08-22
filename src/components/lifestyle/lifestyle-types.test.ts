import { describe, it, expect } from 'vitest'
import {
  getDayId,
  getLastDayIds,
  average,
  trendPct,
  buildDailySeries,
  computeReadiness,
  computeGoalProgress,
  type HealthMetricLike,
} from './lifestyle-types'

function ts(seconds: number) {
  return { seconds }
}

function dateSeconds(y: number, m: number, d: number) {
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000)
}

describe('getDayId', () => {
  it('formats yyyy-MM-dd with zero-padding', () => {
    expect(getDayId(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getLastDayIds', () => {
  it('returns count days ending at `from`, oldest first', () => {
    const ids = getLastDayIds(3, new Date(2026, 2, 10))
    expect(ids).toEqual(['2026-03-08', '2026-03-09', '2026-03-10'])
  })

  it('handles month rollover', () => {
    const ids = getLastDayIds(3, new Date(2026, 2, 1))
    expect(ids).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('average', () => {
  it('averages a list of numbers', () => {
    expect(average([1, 2, 3])).toBe(2)
  })
  it('returns 0 for an empty list', () => {
    expect(average([])).toBe(0)
  })
})

describe('trendPct', () => {
  it('computes percent change', () => {
    expect(trendPct(50, 60)).toBe(20)
    expect(trendPct(60, 50)).toBe(-17)
  })
  it('returns 0 when the starting value is 0', () => {
    expect(trendPct(0, 60)).toBe(0)
  })
})

describe('buildDailySeries', () => {
  it('maps entries onto the requested day ids, leaving gaps empty', () => {
    const metrics: HealthMetricLike[] = [
      { date: ts(dateSeconds(2026, 3, 1)), sleepHours: 7 },
      { date: ts(dateSeconds(2026, 3, 3)), sleepHours: 8 },
    ]
    const series = buildDailySeries(metrics, ['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(series.map((s) => s.dayId)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(series[0].sleepHours).toBe(7)
    expect(series[1].sleepHours).toBeUndefined()
    expect(series[2].sleepHours).toBe(8)
  })
})

describe('computeReadiness', () => {
  it('returns null when there is no entry', () => {
    expect(computeReadiness(undefined)).toBeNull()
  })

  it('returns null when the entry has none of the relevant fields', () => {
    expect(computeReadiness({ date: null })).toBeNull()
  })

  it('averages sleepQuality, inverted stress, and mood*10', () => {
    // sleepQuality 80, stress 20 (-> 80), mood 8 (-> 80): average 80
    expect(computeReadiness({ date: null, sleepQuality: 80, stressScore: 20, mood: 8 })).toBe(80)
  })

  it('works with a partial entry', () => {
    expect(computeReadiness({ date: null, sleepQuality: 60 })).toBe(60)
  })
})

describe('computeGoalProgress', () => {
  it('caps at 100% for a "min" goal once the average meets the target', () => {
    const recent: HealthMetricLike[] = [{ date: null, sleepHours: 8 }, { date: null, sleepHours: 9 }]
    const progress = computeGoalProgress({ metric: 'sleepHours', target: 7, direction: 'min' }, recent)
    expect(progress.met).toBe(true)
    expect(progress.pct).toBe(100)
    expect(progress.currentAvg).toBeCloseTo(8.5)
  })

  it('scales proportionally below target for a "min" goal', () => {
    const recent: HealthMetricLike[] = [{ date: null, sleepHours: 3.5 }]
    const progress = computeGoalProgress({ metric: 'sleepHours', target: 7, direction: 'min' }, recent)
    expect(progress.met).toBe(false)
    expect(progress.pct).toBe(50)
  })

  it('treats being under target as 100% for a "max" goal', () => {
    const recent: HealthMetricLike[] = [{ date: null, stressScore: 20 }]
    const progress = computeGoalProgress({ metric: 'stressScore', target: 30, direction: 'max' }, recent)
    expect(progress.met).toBe(true)
    expect(progress.pct).toBe(100)
  })

  it('degrades the score when average exceeds a "max" target', () => {
    const recent: HealthMetricLike[] = [{ date: null, stressScore: 60 }]
    const progress = computeGoalProgress({ metric: 'stressScore', target: 30, direction: 'max' }, recent)
    expect(progress.met).toBe(false)
    expect(progress.pct).toBe(50)
  })

  it('returns 0/false when there is no data for the tracked metric', () => {
    const progress = computeGoalProgress({ metric: 'hrv', target: 60, direction: 'min' }, [{ date: null, sleepHours: 7 }])
    expect(progress.pct).toBe(0)
    expect(progress.met).toBe(false)
  })
})
