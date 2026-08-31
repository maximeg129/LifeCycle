import { describe, it, expect } from 'vitest'
import { computeSessionRPE, computeDailyLoad, computeMonotony, computeStrain } from './load'

describe('computeSessionRPE', () => {
  it('multiplies RPE by duration in minutes', () => {
    expect(computeSessionRPE(6, 90)).toBe(540)
  })

  it('is zero for a zero-duration or zero-RPE session', () => {
    expect(computeSessionRPE(6, 0)).toBe(0)
    expect(computeSessionRPE(0, 90)).toBe(0)
  })
})

describe('computeDailyLoad', () => {
  it('sums multiple sessions on the same day', () => {
    expect(computeDailyLoad([540, 120])).toBe(660)
  })

  it('is zero for a rest day (no sessions)', () => {
    expect(computeDailyLoad([])).toBe(0)
  })
})

describe('computeMonotony', () => {
  it('is mean / population standard deviation', () => {
    // loads: 100, 200, 100, 200 -> mean 150, variance 2500, sd 50 -> 150/50 = 3
    expect(computeMonotony([100, 200, 100, 200])).toBeCloseTo(3, 5)
  })

  it('returns null (not Infinity) when the load is perfectly constant — the ratio is undefined', () => {
    expect(computeMonotony([200, 200, 200, 200])).toBeNull()
  })

  it('returns null with fewer than 2 days of data', () => {
    expect(computeMonotony([])).toBeNull()
    expect(computeMonotony([200])).toBeNull()
  })

  it('is higher for a flatter load pattern than a spiky one with the same total', () => {
    const spiky = computeMonotony([50, 250, 50, 250])!
    const nearFlat = computeMonotony([140, 160, 140, 160])!
    expect(nearFlat).toBeGreaterThan(spiky)
  })
})

describe('computeStrain', () => {
  it('is weekly total load times monotony', () => {
    const loads = [100, 200, 100, 200]
    const total = 600
    const monotony = computeMonotony(loads)!
    expect(computeStrain(loads)).toBeCloseTo(total * monotony, 5)
  })

  it('returns null when monotony is not computable', () => {
    expect(computeStrain([200, 200, 200])).toBeNull()
    expect(computeStrain([])).toBeNull()
  })
})
