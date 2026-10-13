import { describe, it, expect } from 'vitest'
import { downsampleRideSeries, chartSeriesRange, buildChartLineSegments, buildIntervalTargetWindows } from './ride-chart-types'
import type { IntervalAdherenceStep } from './interval-adherence-types'

describe('downsampleRideSeries', () => {
  it('returns null when both streams are empty', () => {
    expect(downsampleRideSeries([], [])).toBeNull()
    expect(downsampleRideSeries(undefined, undefined)).toBeNull()
  })

  it('returns one point per second when the stream is shorter than maxPoints', () => {
    const result = downsampleRideSeries([100, 110, 120], [140, 142, 144])
    expect(result).not.toBeNull()
    expect(result!.totalSeconds).toBe(3)
    expect(result!.points).toHaveLength(3)
    expect(result!.points[0]).toEqual({ t: 0, watts: 100, hr: 140 })
  })

  it('averages each bucket without inventing values across a gap', () => {
    // 6 points, maxPoints=2 → 2 buckets of 3 seconds each; watts stops after
    // 3 seconds (shorter stream than heartrate) so the second bucket has no
    // watts data at all — must stay null, never averaged from nothing.
    const wattsShort = [100, 100, 100]
    const hrFull = [140, 142, 144, 146, 148, 150]
    const result = downsampleRideSeries(wattsShort, hrFull, 2)
    expect(result).not.toBeNull()
    expect(result!.points).toHaveLength(2)
    expect(result!.points[0].watts).toBe(100) // first bucket (seconds 0-2) has watts data
    expect(result!.points[1].watts).toBeNull() // second bucket (seconds 3-5) has no watts data at all
    expect(result!.points[1].hr).toBe(148) // average of 146,148,150
  })

  it('caps the point count at maxPoints for a long stream', () => {
    const watts = Array.from({ length: 3600 }, (_, i) => 100 + (i % 50))
    const result = downsampleRideSeries(watts, undefined, 60)
    expect(result!.points).toHaveLength(60)
    expect(result!.totalSeconds).toBe(3600)
  })
})

describe('chartSeriesRange', () => {
  it('returns null when every value is null', () => {
    expect(chartSeriesRange([{ t: 0, watts: null, hr: null }], (p) => p.watts)).toBeNull()
  })

  it('returns the real min/max, ignoring nulls', () => {
    const points = [{ t: 0, watts: 100, hr: null }, { t: 1, watts: null, hr: null }, { t: 2, watts: 200, hr: null }]
    expect(chartSeriesRange(points, (p) => p.watts)).toEqual({ min: 100, max: 200 })
  })
})

describe('buildChartLineSegments', () => {
  it('returns an empty array for a zero-length series', () => {
    expect(buildChartLineSegments([], (p) => p.watts, 0, 0, 100, 600, 140, 10)).toEqual([])
  })

  it('builds one continuous segment when there is no data gap', () => {
    const points = [{ t: 0, watts: 100, hr: null }, { t: 5, watts: 150, hr: null }, { t: 10, watts: 200, hr: null }]
    const segments = buildChartLineSegments(points, (p) => p.watts, 10, 100, 200, 600, 140, 10)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toHaveLength(3)
    // Highest value (200 at t=10) maps to the top of the chart (smallest y, after padding).
    expect(segments[0][2].y).toBeCloseTo(10, 5)
    // Lowest value (100 at t=0) maps to the bottom of the chart.
    expect(segments[0][0].y).toBeCloseTo(130, 5)
  })

  it('splits into separate segments across a null gap, never interpolating', () => {
    const points = [
      { t: 0, watts: 100, hr: null },
      { t: 1, watts: null, hr: null },
      { t: 2, watts: null, hr: null },
      { t: 3, watts: 150, hr: null },
    ]
    const segments = buildChartLineSegments(points, (p) => p.watts, 4, 100, 150, 600, 140, 10)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toHaveLength(1)
    expect(segments[1]).toHaveLength(1)
  })

  it('centers a flat series (min === max) at mid-height rather than dividing by zero', () => {
    const points = [{ t: 0, watts: 100, hr: null }, { t: 1, watts: 100, hr: null }]
    const segments = buildChartLineSegments(points, (p) => p.watts, 2, 100, 100, 600, 140, 10)
    expect(segments[0][0].y).toBe(70)
    expect(segments[0][1].y).toBe(70)
  })
})

describe('buildIntervalTargetWindows', () => {
  it('returns an empty array for no steps', () => {
    expect(buildIntervalTargetWindows([])).toEqual([])
  })

  it('accumulates start/end offsets in order from each step duration', () => {
    const steps: IntervalAdherenceStep[] = [
      { index: 0, targetDurationSeconds: 300, targetPctLow: 60, targetPctHigh: 70, actualAvgWatts: 180, actualPctFtp: 65, verdict: 'within' },
      { index: 1, targetDurationSeconds: 240, targetPctLow: 100, targetPctHigh: 110, actualAvgWatts: 280, actualPctFtp: 105, verdict: 'within' },
      { index: 2, targetDurationSeconds: 600, targetPctLow: 55, targetPctHigh: 65, actualAvgWatts: 150, actualPctFtp: 54, verdict: 'below' },
    ]
    const windows = buildIntervalTargetWindows(steps)
    expect(windows).toEqual([
      { startSeconds: 0, endSeconds: 300, pctLow: 60, pctHigh: 70, verdict: 'within' },
      { startSeconds: 300, endSeconds: 540, pctLow: 100, pctHigh: 110, verdict: 'within' },
      { startSeconds: 540, endSeconds: 1140, pctLow: 55, pctHigh: 65, verdict: 'below' },
    ])
  })
})
