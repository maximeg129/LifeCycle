import { describe, it, expect } from 'vitest'
import { tsbRingPercent, tsbRingColor, readinessRingColor, sleepRingPercent } from './ring-metrics'

describe('tsbRingPercent', () => {
  it('maps the -30..20 window onto 0..100', () => {
    expect(tsbRingPercent(-30)).toBe(0)
    expect(tsbRingPercent(20)).toBe(100)
    expect(tsbRingPercent(-5)).toBe(50)
  })

  it('clamps values outside the window rather than over/undershooting', () => {
    expect(tsbRingPercent(-60)).toBe(0)
    expect(tsbRingPercent(40)).toBe(100)
  })
})

describe('tsbRingColor', () => {
  it('matches the same zone tsbZone() would classify the value into', () => {
    expect(tsbRingColor(30)).toBe('#f97316') // transition
    expect(tsbRingColor(-40)).toBe('hsl(var(--destructive))') // high-risk
  })
})

describe('readinessRingColor', () => {
  it('follows the same thresholds as the existing Readiness tile sublabel', () => {
    expect(readinessRingColor(90)).toBe('#22c55e')
    expect(readinessRingColor(60)).toBe('#f97316')
    expect(readinessRingColor(30)).toBe('hsl(var(--destructive))')
  })

  it('places the boundary values in the lower band', () => {
    expect(readinessRingColor(75)).toBe('#f97316')
    expect(readinessRingColor(50)).toBe('hsl(var(--destructive))')
  })
})

describe('sleepRingPercent', () => {
  it('uses sleep quality directly when known', () => {
    expect(sleepRingPercent(6, 82)).toBe(82)
  })

  it('falls back to hours against a 9h reference when quality is unknown', () => {
    expect(sleepRingPercent(4.5, null)).toBe(50)
    expect(sleepRingPercent(9, undefined)).toBe(100)
  })

  it('clamps the hours fallback at 100 for a very long night', () => {
    expect(sleepRingPercent(12, null)).toBe(100)
  })

  it('is 0 when neither hours nor quality are known', () => {
    expect(sleepRingPercent(null, null)).toBe(0)
    expect(sleepRingPercent(undefined, undefined)).toBe(0)
  })
})
