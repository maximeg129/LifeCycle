import { describe, it, expect } from 'vitest'
import { tsbConfidence, readinessConfidence, sleepConfidence, vitalsConfidence, buildReadinessVerdict, sparklinePoints } from './readiness-strip-types'

describe('tsbConfidence', () => {
  it('is unknown without a value', () => {
    expect(tsbConfidence(null)).toBe('unknown')
    expect(tsbConfidence(undefined)).toBe('unknown')
  })
  it('is good in fresh/optimal zones', () => {
    expect(tsbConfidence(10)).toBe('good') // fresh
    expect(tsbConfidence(-15)).toBe('good') // optimal
  })
  it('is warn in grey/transition zones', () => {
    expect(tsbConfidence(0)).toBe('warn') // grey
    expect(tsbConfidence(25)).toBe('warn') // transition
  })
  it('is bad in high-risk', () => {
    expect(tsbConfidence(-35)).toBe('bad')
  })
})

describe('readinessConfidence', () => {
  it('is unknown without a value', () => {
    expect(readinessConfidence(null)).toBe('unknown')
  })
  it('matches the existing /lifestyle thresholds', () => {
    expect(readinessConfidence(80)).toBe('good')
    expect(readinessConfidence(60)).toBe('warn')
    expect(readinessConfidence(30)).toBe('bad')
  })
})

describe('sleepConfidence', () => {
  it('is unknown without a value', () => {
    expect(sleepConfidence(undefined)).toBe('unknown')
  })
  it('maps great/good to good, average to warn, poor to bad', () => {
    expect(sleepConfidence(95)).toBe('good')
    expect(sleepConfidence(85)).toBe('good')
    expect(sleepConfidence(70)).toBe('warn')
    expect(sleepConfidence(40)).toBe('bad')
  })
})

describe('vitalsConfidence', () => {
  it('is unknown only when both HRV and resting HR are missing', () => {
    expect(vitalsConfidence(null, null)).toBe('unknown')
  })
  it('is neutral when at least one is present — never a favorable/unfavorable judgment on HRV alone', () => {
    expect(vitalsConfidence(55, null)).toBe('neutral')
    expect(vitalsConfidence(null, 48)).toBe('neutral')
    expect(vitalsConfidence(55, 48)).toBe('neutral')
  })
})

describe('buildReadinessVerdict', () => {
  it('is unknown when both TSB and readiness are missing', () => {
    const v = buildReadinessVerdict(null, null)
    expect(v.confidence).toBe('unknown')
  })
  it('is good when both signals are favorable', () => {
    const v = buildReadinessVerdict(-12, 85)
    expect(v.confidence).toBe('good')
    expect(v.title).toBe('Prêt à performer')
    expect(v.sentence).toContain('TSB en charge productive')
  })
  it('takes the worse of the two signals', () => {
    const v = buildReadinessVerdict(-12, 30) // TSB good, readiness bad
    expect(v.confidence).toBe('bad')
    expect(v.title).toBe('Récupération prioritaire')
  })
  it('degrades gracefully when only one signal is known', () => {
    const v = buildReadinessVerdict(null, 85)
    expect(v.confidence).toBe('good')
    expect(v.sentence).not.toContain('TSB')
  })
})

describe('sparklinePoints', () => {
  it('is null with fewer than 2 values — nothing to trace', () => {
    expect(sparklinePoints([], 40, 12)).toBeNull()
    expect(sparklinePoints([50], 40, 12)).toBeNull()
  })
  it('traces a flat line at mid-height when all values are equal', () => {
    const points = sparklinePoints([50, 50, 50], 40, 12)
    expect(points).toBe('0.0,6.0 20.0,6.0 40.0,6.0')
  })
  it('normalizes min/max across the full height', () => {
    const points = sparklinePoints([0, 100], 40, 12)
    expect(points).toBe('0.0,12.0 40.0,0.0')
  })
})
