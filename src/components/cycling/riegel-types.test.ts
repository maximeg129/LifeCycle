import { describe, it, expect } from 'vitest'
import { pickPowerRecordsFromCurve } from './riegel-types'

describe('pickPowerRecordsFromCurve', () => {
  // A realistic Intervals.icu-style curve: a handful of standard duration
  // buckets, power decreasing with duration.
  const secs = [5, 60, 300, 1200, 3600, 5400]
  const values = [900, 500, 320, 260, 220, 200]

  it('picks the closest bucket to each target duration', () => {
    const picked = pickPowerRecordsFromCurve(secs, values)
    expect(picked.shortRecord).toEqual({ seconds: 300, watts: 320 }) // exact 5min match
    expect(picked.mediumRecord).toEqual({ seconds: 1200, watts: 260 }) // exact 20min match
    expect(picked.longRecord).toEqual({ seconds: 5400, watts: 200 }) // exact 90min match
  })

  it('falls back to the nearest available bucket when there is no exact match', () => {
    // No 90min bucket available — closest is 60min (3600s).
    const picked = pickPowerRecordsFromCurve([5, 300, 1200, 3600], [900, 320, 260, 220])
    expect(picked.longRecord).toEqual({ seconds: 3600, watts: 220 })
  })

  it('returns nulls for an empty curve', () => {
    expect(pickPowerRecordsFromCurve([], [])).toEqual({ shortRecord: null, mediumRecord: null, longRecord: null })
  })

  it('ignores a bucket with a non-positive value', () => {
    const picked = pickPowerRecordsFromCurve([300], [0])
    expect(picked.shortRecord).toBeNull()
  })
})
