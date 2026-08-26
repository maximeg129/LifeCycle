import { describe, it, expect } from 'vitest'
import {
  averageOrNull,
  splitRecentBaseline,
  windowedTrendSignal,
  efficiencyFactor,
  feelingsSignal,
  computeInternalLoadStatus,
} from './governor-types'

describe('averageOrNull', () => {
  it('averages values', () => {
    expect(averageOrNull([1, 2, 3])).toBe(2)
  })
  it('is null for an empty list', () => {
    expect(averageOrNull([])).toBeNull()
  })
})

describe('splitRecentBaseline', () => {
  it('splits a series into recent and preceding baseline windows', () => {
    const series = [
      { date: '2026-02-21', value: 1 }, // baseline
      { date: '2026-03-01', value: 2 }, // baseline
      { date: '2026-03-18', value: 3 }, // recent
      { date: '2026-03-20', value: 4 }, // recent (reference)
    ]
    const { recent, baseline } = splitRecentBaseline(series, '2026-03-20', 7, 21)
    expect(recent).toEqual([3, 4])
    expect(baseline).toEqual([1, 2])
  })
})

describe('windowedTrendSignal', () => {
  const referenceIso = '2026-03-20'
  it('is favorable when a "lower is better" metric drops', () => {
    const series = [
      { date: '2026-02-25', value: 50 }, { date: '2026-02-28', value: 50 }, // baseline
      { date: '2026-03-15', value: 44 }, { date: '2026-03-19', value: 44 }, // recent
    ]
    expect(windowedTrendSignal(series, referenceIso, 'lower')).toBe(1)
  })
  it('is unfavorable when a "higher is better" metric drops', () => {
    const series = [
      { date: '2026-02-25', value: 60 }, { date: '2026-02-28', value: 60 }, // baseline
      { date: '2026-03-15', value: 50 }, { date: '2026-03-19', value: 50 }, // recent
    ]
    expect(windowedTrendSignal(series, referenceIso, 'higher')).toBe(-1)
  })
  it('is neutral within the threshold', () => {
    const series = [
      { date: '2026-02-25', value: 50 }, { date: '2026-02-28', value: 50 },
      { date: '2026-03-15', value: 50.5 }, { date: '2026-03-19', value: 50.5 },
    ]
    expect(windowedTrendSignal(series, referenceIso, 'lower')).toBe(0)
  })
  it('returns null without enough data in either window', () => {
    expect(windowedTrendSignal([{ date: '2026-03-19', value: 50 }], referenceIso, 'lower')).toBeNull()
  })
})

describe('efficiencyFactor', () => {
  it('divides watts by heart rate', () => {
    expect(efficiencyFactor(150, 120)).toBe(1.25)
  })
  it('is null without both values', () => {
    expect(efficiencyFactor(null, 120)).toBeNull()
    expect(efficiencyFactor(150, 0)).toBeNull()
  })
})

describe('feelingsSignal', () => {
  it('averages recent feeling scores into a signal', () => {
    expect(feelingsSignal([{ date: '2026-03-19', value: 1 }, { date: '2026-03-18', value: 1 }], '2026-03-20')).toBe(1)
    expect(feelingsSignal([{ date: '2026-03-19', value: -1 }, { date: '2026-03-18', value: -1 }], '2026-03-20')).toBe(-1)
  })
  it('is null with no recent entries', () => {
    expect(feelingsSignal([], '2026-03-20')).toBeNull()
  })
})

const NO_SIGNALS = { restingHR: null, hrvTrend: null, effortHrDrift: null, rpe: null, feelings: null, sleepRecovery: null }

describe('computeInternalLoadStatus', () => {
  it('is insufficient_data with fewer than 2 signals', () => {
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: 1 })).toBe('insufficient_data')
  })
  it('is vert when signals net favorable', () => {
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: 1, hrvTrend: 1, effortHrDrift: 0 })).toBe('vert')
  })
  it('is rouge when signals net unfavorable', () => {
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: -1, hrvTrend: -1, effortHrDrift: 0 })).toBe('rouge')
  })
  it('is orange when signals balance out', () => {
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: 1, hrvTrend: -1 })).toBe('orange')
  })
  it('folds the sleep/recovery signal from Vie & Santé into the aggregate', () => {
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: 1, sleepRecovery: 1 })).toBe('vert')
    expect(computeInternalLoadStatus({ ...NO_SIGNALS, restingHR: 1, sleepRecovery: -1 })).toBe('orange')
  })
})
