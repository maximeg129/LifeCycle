import { describe, it, expect } from 'vitest'
import { computeDecoupling } from './decoupling'

describe('computeDecoupling', () => {
  it('is zero when power and HR are both flat across the whole effort (no drift)', () => {
    const watts = [200, 200, 200, 200]
    const hr = [140, 140, 140, 140]
    const result = computeDecoupling(watts, hr)!
    expect(result.decouplingPct).toBeCloseTo(0, 5)
  })

  it('is positive when HR rises relative to power in the second half (cardiac drift)', () => {
    // First half: 200W @ 140bpm (EF ~1.43). Second half: 200W @ 154bpm (EF ~1.30) — HR drifted up, power held.
    const watts = [200, 200, 200, 200]
    const hr = [140, 140, 154, 154]
    const result = computeDecoupling(watts, hr)!
    expect(result.decouplingPct).toBeGreaterThan(0)
  })

  it('is negative when efficiency improves in the second half', () => {
    const watts = [200, 200, 200, 200]
    const hr = [154, 154, 140, 140]
    const result = computeDecoupling(watts, hr)!
    expect(result.decouplingPct).toBeLessThan(0)
  })

  it('returns null for mismatched series lengths', () => {
    expect(computeDecoupling([200, 200], [140])).toBeNull()
  })

  it('returns null when there are too few points to split into two halves', () => {
    expect(computeDecoupling([200], [140])).toBeNull()
    expect(computeDecoupling([], [])).toBeNull()
  })

  it('returns null rather than Infinity/NaN when a half has zero average heart rate', () => {
    expect(computeDecoupling([200, 200, 200, 200], [140, 140, 0, 0])).toBeNull()
  })
})
