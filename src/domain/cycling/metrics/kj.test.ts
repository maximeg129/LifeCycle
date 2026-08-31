import { describe, it, expect } from 'vitest'
import {
  sessionKJPerKg,
  mondayOf,
  bucketWeeklyKJPerKg,
  baselineKJPerKg,
  currentWeekKJPerKg,
  computeKJPerKgTrend,
  computeTargetKJPerKg,
  checkAgainstDurabilityCeilings,
} from './kj'

describe('sessionKJPerKg', () => {
  it('computes kJ/kg from average power, duration and athlete weight', () => {
    // 200W x 3600s / 1000 = 720 kJ ; / 80kg = 9 kJ/kg
    expect(sessionKJPerKg({ average_watts: 200, moving_time: 3600 }, 80)).toBe(9)
  })

  it('prefers the real average power over normalized/weighted power, even when higher', () => {
    // Même bug que load-types.ts (voir CLAUDE.md — bestAverageWatts) :
    // la puissance normalisée est structurellement >= la moyenne réelle
    // sur une sortie à intensité variable, donc jamais celle à utiliser
    // pour un "vrai travail mécanique".
    expect(sessionKJPerKg({ average_watts: 200, weighted_average_watts: 210, moving_time: 3600 }, 80)).toBe(9)
  })

  it('returns null without power data', () => {
    expect(sessionKJPerKg({ moving_time: 3600 }, 80)).toBeNull()
    expect(sessionKJPerKg({ average_watts: 0, moving_time: 3600 }, 80)).toBeNull()
  })

  it('returns null without duration', () => {
    expect(sessionKJPerKg({ average_watts: 200 }, 80)).toBeNull()
  })

  it('returns null without a known, positive athlete weight — never falls back to raw kJ', () => {
    expect(sessionKJPerKg({ average_watts: 200, moving_time: 3600 }, null)).toBeNull()
    expect(sessionKJPerKg({ average_watts: 200, moving_time: 3600 }, undefined)).toBeNull()
    expect(sessionKJPerKg({ average_watts: 200, moving_time: 3600 }, 0)).toBeNull()
    expect(sessionKJPerKg({ average_watts: 200, moving_time: 3600 }, -70)).toBeNull()
  })

  it('uses the icu_-prefixed power fields (the ones Intervals.icu actually populates)', () => {
    expect(sessionKJPerKg({ icu_average_watts: 200, moving_time: 3600 }, 80)).toBe(9)
  })
})

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-03-23')).toBe('2026-03-23')
  })

  it('rolls back to Monday for other days of the week', () => {
    expect(mondayOf('2026-03-25')).toBe('2026-03-23') // mercredi
    expect(mondayOf('2026-03-29')).toBe('2026-03-23') // dimanche
  })
})

describe('bucketWeeklyKJPerKg', () => {
  it('sums kJ/kg per ISO week and tracks data coverage', () => {
    const buckets = bucketWeeklyKJPerKg(
      [
        { start_date_local: '2026-03-23T10:00:00', average_watts: 200, moving_time: 3600 }, // lundi
        { start_date_local: '2026-03-25T10:00:00', average_watts: 150, moving_time: 3600 }, // mercredi, même semaine
        { start_date_local: '2026-03-25T18:00:00', moving_time: 1800 }, // mercredi, sans puissance
        { start_date_local: '2026-03-30T10:00:00', average_watts: 100, moving_time: 3600 }, // lundi suivant
      ],
      80
    )
    expect(buckets).toEqual([
      { weekStart: '2026-03-23', kJPerKg: 9 + 6.75, sessionsWithData: 2, sessionsTotal: 3 },
      { weekStart: '2026-03-30', kJPerKg: 4.5, sessionsWithData: 1, sessionsTotal: 1 },
    ])
  })

  it('returns empty buckets (never raw kJ) when athlete weight is unknown', () => {
    const buckets = bucketWeeklyKJPerKg(
      [{ start_date_local: '2026-03-23T10:00:00', average_watts: 200, moving_time: 3600 }],
      null
    )
    expect(buckets).toEqual([{ weekStart: '2026-03-23', kJPerKg: 0, sessionsWithData: 0, sessionsTotal: 1 }])
  })
})

describe('baselineKJPerKg', () => {
  it('averages the recent completed weeks, excluding the current week', () => {
    const buckets = [
      { weekStart: '2026-03-02', kJPerKg: 10, sessionsWithData: 2, sessionsTotal: 2 },
      { weekStart: '2026-03-09', kJPerKg: 12, sessionsWithData: 2, sessionsTotal: 2 },
      { weekStart: '2026-03-16', kJPerKg: 8, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-03-23', kJPerKg: 5, sessionsWithData: 1, sessionsTotal: 1 }, // en cours
    ]
    expect(baselineKJPerKg(buckets, '2026-03-23', 8)).toBeCloseTo(10, 5) // avg(10,12,8)
  })

  it('is 0 with no completed weeks of data', () => {
    expect(baselineKJPerKg([], '2026-03-23')).toBe(0)
  })
})

describe('currentWeekKJPerKg', () => {
  it('reads the bucket matching the reference Monday', () => {
    const buckets = [{ weekStart: '2026-03-23', kJPerKg: 4.56, sessionsWithData: 1, sessionsTotal: 1 }]
    expect(currentWeekKJPerKg(buckets, '2026-03-23')).toBe(4.56)
  })

  it('is 0 when the current week has no bucket yet', () => {
    expect(currentWeekKJPerKg([], '2026-03-23')).toBe(0)
  })
})

describe('computeKJPerKgTrend', () => {
  it('needs at least 4 completed weeks to call a trend', () => {
    const buckets = [
      { weekStart: '2026-03-02', kJPerKg: 10, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-03-09', kJPerKg: 10, sessionsWithData: 1, sessionsTotal: 1 },
    ]
    expect(computeKJPerKgTrend(buckets, '2026-03-23')).toEqual({ direction: 'flat', pctChange: 0 })
  })

  it('detects an upward trend across the window', () => {
    const buckets = [
      { weekStart: '2026-02-02', kJPerKg: 8, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-09', kJPerKg: 8.5, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-16', kJPerKg: 12, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-23', kJPerKg: 12.5, sessionsWithData: 1, sessionsTotal: 1 },
    ]
    const trend = computeKJPerKgTrend(buckets, '2026-03-23')
    expect(trend.direction).toBe('up')
    expect(trend.pctChange).toBeGreaterThan(5)
  })

  it('detects a downward trend across the window', () => {
    const buckets = [
      { weekStart: '2026-02-02', kJPerKg: 12, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-09', kJPerKg: 12.5, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-16', kJPerKg: 8, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-23', kJPerKg: 7.5, sessionsWithData: 1, sessionsTotal: 1 },
    ]
    const trend = computeKJPerKgTrend(buckets, '2026-03-23')
    expect(trend.direction).toBe('down')
    expect(trend.pctChange).toBeLessThan(-5)
  })

  it('calls a small fluctuation flat rather than noise-chasing', () => {
    const buckets = [
      { weekStart: '2026-02-02', kJPerKg: 10, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-09', kJPerKg: 10.1, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-16', kJPerKg: 10.2, sessionsWithData: 1, sessionsTotal: 1 },
      { weekStart: '2026-02-23', kJPerKg: 10.1, sessionsWithData: 1, sessionsTotal: 1 },
    ]
    expect(computeKJPerKgTrend(buckets, '2026-03-23').direction).toBe('flat')
  })
})

describe('computeTargetKJPerKg', () => {
  it('nudges up ~8% on a favorable governor status (KJ_TARGET_NUDGE.greenPct)', () => {
    expect(computeTargetKJPerKg(10, 'vert')).toBeCloseTo(10.8, 5)
  })

  it('holds steady when stable or data is insufficient', () => {
    expect(computeTargetKJPerKg(10, 'orange')).toBe(10)
    expect(computeTargetKJPerKg(10, 'insufficient_data')).toBe(10)
  })

  it('pulls back ~12% on a degraded status (KJ_TARGET_NUDGE.redPct)', () => {
    expect(computeTargetKJPerKg(10, 'rouge')).toBeCloseTo(8.8, 5)
  })

  it('is 0 with no baseline', () => {
    expect(computeTargetKJPerKg(0, 'vert')).toBe(0)
  })
})

describe('checkAgainstDurabilityCeilings', () => {
  it('reports null when under the first sourced threshold', () => {
    expect(checkAgainstDurabilityCeilings(5).exceedsThresholdKJPerKg).toBeNull()
    expect(checkAgainstDurabilityCeilings(9.99).exceedsThresholdKJPerKg).toBeNull()
  })

  it('reports the highest threshold reached or exceeded, not just whether one was crossed', () => {
    expect(checkAgainstDurabilityCeilings(10).exceedsThresholdKJPerKg).toBe(10)
    expect(checkAgainstDurabilityCeilings(15).exceedsThresholdKJPerKg).toBe(10)
    expect(checkAgainstDurabilityCeilings(20).exceedsThresholdKJPerKg).toBe(20)
    expect(checkAgainstDurabilityCeilings(35).exceedsThresholdKJPerKg).toBe(30)
    expect(checkAgainstDurabilityCeilings(40).exceedsThresholdKJPerKg).toBe(40)
    expect(checkAgainstDurabilityCeilings(999).exceedsThresholdKJPerKg).toBe(40) // pas de palier au-delà de 40 dans la source
  })

  it('echoes the input value unchanged', () => {
    expect(checkAgainstDurabilityCeilings(23.4).kJPerKg).toBe(23.4)
  })
})
