import { describe, it, expect } from 'vitest'
import {
  sessionKJ,
  mondayOf,
  bucketWeeklyKJ,
  baselineKJ,
  currentWeekKJ,
  computeKJTrend,
  computeTargetKJ,
} from './load-types'

describe('sessionKJ', () => {
  it('computes kJ from average power and duration', () => {
    expect(sessionKJ({ average_watts: 200, moving_time: 3600 })).toBe(720)
  })
  it('prefers weighted average power when available', () => {
    expect(sessionKJ({ average_watts: 200, weighted_average_watts: 210, moving_time: 3600 })).toBe(756)
  })
  it('returns null without power data', () => {
    expect(sessionKJ({ moving_time: 3600 })).toBeNull()
    expect(sessionKJ({ average_watts: 0, moving_time: 3600 })).toBeNull()
  })
  it('returns null without duration', () => {
    expect(sessionKJ({ average_watts: 200 })).toBeNull()
  })
})

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-03-23')).toBe('2026-03-23') // a Monday
  })
  it('rolls back to Monday for other days of the week', () => {
    expect(mondayOf('2026-03-25')).toBe('2026-03-23') // Wednesday
    expect(mondayOf('2026-03-29')).toBe('2026-03-23') // Sunday
  })
})

describe('bucketWeeklyKJ', () => {
  it('sums kJ per ISO week and tracks power coverage', () => {
    const buckets = bucketWeeklyKJ([
      { start_date_local: '2026-03-23T10:00:00', average_watts: 200, moving_time: 3600 }, // Mon
      { start_date_local: '2026-03-25T10:00:00', average_watts: 150, moving_time: 3600 }, // Wed, same week
      { start_date_local: '2026-03-25T18:00:00', moving_time: 1800 }, // Wed, no power
      { start_date_local: '2026-03-30T10:00:00', average_watts: 100, moving_time: 3600 }, // next Monday
    ])
    expect(buckets).toEqual([
      { weekStart: '2026-03-23', kJ: 720 + 540, sessionsWithPower: 2, sessionsTotal: 3 },
      { weekStart: '2026-03-30', kJ: 360, sessionsWithPower: 1, sessionsTotal: 1 },
    ])
  })
})

describe('baselineKJ', () => {
  it('averages the recent completed weeks, excluding the current week', () => {
    const buckets = [
      { weekStart: '2026-03-02', kJ: 1000, sessionsWithPower: 2, sessionsTotal: 2 },
      { weekStart: '2026-03-09', kJ: 1200, sessionsWithPower: 2, sessionsTotal: 2 },
      { weekStart: '2026-03-16', kJ: 800, sessionsWithPower: 1, sessionsTotal: 1 },
      { weekStart: '2026-03-23', kJ: 500, sessionsWithPower: 1, sessionsTotal: 1 }, // current, in-progress week
    ]
    expect(baselineKJ(buckets, '2026-03-23', 8)).toBe(1000) // avg(1000,1200,800)
  })
  it('is 0 with no completed weeks of data', () => {
    expect(baselineKJ([], '2026-03-23')).toBe(0)
  })
})

describe('currentWeekKJ', () => {
  it('reads the bucket matching the reference Monday', () => {
    const buckets = [{ weekStart: '2026-03-23', kJ: 456, sessionsWithPower: 1, sessionsTotal: 1 }]
    expect(currentWeekKJ(buckets, '2026-03-23')).toBe(456)
  })
  it('is 0 when the current week has no bucket yet', () => {
    expect(currentWeekKJ([], '2026-03-23')).toBe(0)
  })
})

describe('computeKJTrend', () => {
  it('needs at least 4 completed weeks to call a trend', () => {
    const buckets = [
      { weekStart: '2026-03-02', kJ: 1000, sessionsWithPower: 1, sessionsTotal: 1 },
      { weekStart: '2026-03-09', kJ: 1000, sessionsWithPower: 1, sessionsTotal: 1 },
    ]
    expect(computeKJTrend(buckets, '2026-03-23')).toEqual({ direction: 'flat', pctChange: 0 })
  })
  it('detects an upward trend across the window', () => {
    const buckets = [
      { weekStart: '2026-02-02', kJ: 800, sessionsWithPower: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-09', kJ: 850, sessionsWithPower: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-16', kJ: 1200, sessionsWithPower: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-23', kJ: 1250, sessionsWithPower: 1, sessionsTotal: 1 },
    ]
    const trend = computeKJTrend(buckets, '2026-03-23')
    expect(trend.direction).toBe('up')
    expect(trend.pctChange).toBeGreaterThan(5)
  })
})

describe('computeTargetKJ', () => {
  it('nudges up on a favorable governor status', () => {
    expect(computeTargetKJ(1000, 'vert')).toBe(1080)
  })
  it('holds steady when stable or data is insufficient', () => {
    expect(computeTargetKJ(1000, 'orange')).toBe(1000)
    expect(computeTargetKJ(1000, 'insufficient_data')).toBe(1000)
  })
  it('pulls back on a degraded status', () => {
    expect(computeTargetKJ(1000, 'rouge')).toBe(880)
  })
  it('is 0 with no baseline', () => {
    expect(computeTargetKJ(0, 'vert')).toBe(0)
  })
})
