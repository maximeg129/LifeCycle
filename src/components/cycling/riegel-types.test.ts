import { describe, it, expect } from 'vitest'
import { fitPowerDurationCurve, computeTTE, difficultyRatio, type PowerCurve } from './riegel-types'

// Points generated exactly from P(t) = 300 · t^(-0.1), so the fit should
// recover a≈300, e≈0.1, enduranceIndex≈0.9.
const short = { seconds: 300, watts: 300 * Math.pow(300, -0.1) } // 5 min
const medium = { seconds: 1200, watts: 300 * Math.pow(1200, -0.1) } // 20 min
const long = { seconds: 3600, watts: 300 * Math.pow(3600, -0.1) } // 60 min

describe('fitPowerDurationCurve', () => {
  it('recovers the endurance index from 3 records on a known curve', () => {
    const curve = fitPowerDurationCurve([short, medium, long])
    expect(curve).not.toBeNull()
    expect(curve!.a).toBeCloseTo(300, 3)
    expect(curve!.e).toBeCloseTo(0.1, 3)
    expect(curve!.enduranceIndex).toBeCloseTo(0.9, 3)
  })

  it('returns null with fewer than 2 valid records', () => {
    expect(fitPowerDurationCurve([short])).toBeNull()
    expect(fitPowerDurationCurve([])).toBeNull()
  })

  it('ignores zero/negative records', () => {
    const curve = fitPowerDurationCurve([short, medium, long, { seconds: 0, watts: 500 }, { seconds: 100, watts: 0 }])
    expect(curve!.enduranceIndex).toBeCloseTo(0.9, 3)
  })
})

describe('computeTTE', () => {
  it('round-trips: TTE at a record power returns that record duration', () => {
    const curve = fitPowerDurationCurve([short, medium, long])!
    expect(computeTTE(short.watts, curve)).toBeCloseTo(300, 0)
    expect(computeTTE(medium.watts, curve)).toBeCloseTo(1200, 0)
  })
  it('gives a longer TTE for a lower target power', () => {
    const curve = fitPowerDurationCurve([short, medium, long])!
    const tteEasy = computeTTE(100, curve)!
    const tteHard = computeTTE(250, curve)!
    expect(tteEasy).toBeGreaterThan(tteHard)
  })
})

describe('difficultyRatio', () => {
  const curve: PowerCurve = { a: 300, e: 0.1, enduranceIndex: 0.9 }
  it('is close to 1 when the session duration matches the TTE at that power', () => {
    const tte = computeTTE(200, curve)!
    expect(difficultyRatio(tte, 200, curve)).toBeCloseTo(1, 5)
  })
  it('is well below 1 for an easy, short effort at that power', () => {
    const tte = computeTTE(200, curve)!
    expect(difficultyRatio(tte / 4, 200, curve)).toBeCloseTo(0.25, 5)
  })
})
