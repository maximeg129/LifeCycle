import { describe, it, expect } from 'vitest'
import { computeWaxLevel, needsReplacementCheck, waxProgressPct } from './chain-types'

describe('computeWaxLevel', () => {
  it('is ok well below the threshold', () => {
    expect(computeWaxLevel({ kmSinceWax: 100, waxThresholdKm: 250 })).toBe('ok')
  })
  it('is warning at 80% or above', () => {
    expect(computeWaxLevel({ kmSinceWax: 200, waxThresholdKm: 250 })).toBe('warning')
  })
  it('is critical at or beyond the threshold', () => {
    expect(computeWaxLevel({ kmSinceWax: 250, waxThresholdKm: 250 })).toBe('critical')
    expect(computeWaxLevel({ kmSinceWax: 300, waxThresholdKm: 250 })).toBe('critical')
  })
  it('is ok when there is no threshold set', () => {
    expect(computeWaxLevel({ kmSinceWax: 500, waxThresholdKm: 0 })).toBe('ok')
  })
})

describe('needsReplacementCheck', () => {
  it('flags once lifetime km reaches the replace threshold', () => {
    expect(needsReplacementCheck({ totalKm: 6999, replaceThresholdKm: 7000 })).toBe(false)
    expect(needsReplacementCheck({ totalKm: 7000, replaceThresholdKm: 7000 })).toBe(true)
  })
  it('never flags when no threshold is set', () => {
    expect(needsReplacementCheck({ totalKm: 999999, replaceThresholdKm: 0 })).toBe(false)
  })
})

describe('waxProgressPct', () => {
  it('computes a percentage capped at 100', () => {
    expect(waxProgressPct({ kmSinceWax: 125, waxThresholdKm: 250 })).toBe(50)
    expect(waxProgressPct({ kmSinceWax: 400, waxThresholdKm: 250 })).toBe(100)
  })
})
