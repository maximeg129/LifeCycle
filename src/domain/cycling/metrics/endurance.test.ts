import { describe, it, expect } from 'vitest'
import {
  fitEnduranceCurve,
  computeTTE,
  checkRiegelValidityDomain,
  recordsOutsideValidityDomain,
  difficultyRatio,
  fallbackFatigueExponent,
  type EnduranceCurve,
} from './endurance'

// Points générés exactement depuis P(t) = 300 · t^(-0.1), le fit doit donc
// retrouver a≈300, e≈0.1, enduranceIndex≈0.9.
const short = { seconds: 300, watts: 300 * Math.pow(300, -0.1) } // 5 min
const medium = { seconds: 1200, watts: 300 * Math.pow(1200, -0.1) } // 20 min
const long = { seconds: 3600, watts: 300 * Math.pow(3600, -0.1) } // 60 min

describe('fitEnduranceCurve', () => {
  it('recovers the individual endurance index from 3 records on a known curve', () => {
    const curve = fitEnduranceCurve([short, medium, long])
    expect(curve).not.toBeNull()
    expect(curve!.a).toBeCloseTo(300, 3)
    expect(curve!.e).toBeCloseTo(0.1, 3)
    expect(curve!.enduranceIndex).toBeCloseTo(0.9, 3)
  })

  it('returns null with fewer than 2 valid records — never falls back to a universal exponent', () => {
    expect(fitEnduranceCurve([short])).toBeNull()
    expect(fitEnduranceCurve([])).toBeNull()
  })

  it('ignores zero/negative records', () => {
    const curve = fitEnduranceCurve([short, medium, long, { seconds: 0, watts: 500 }, { seconds: 100, watts: 0 }])
    expect(curve!.enduranceIndex).toBeCloseTo(0.9, 3)
  })

  it('returns null when all durations are identical (no slope to fit)', () => {
    expect(fitEnduranceCurve([{ seconds: 300, watts: 250 }, { seconds: 300, watts: 260 }])).toBeNull()
  })
})

describe('computeTTE', () => {
  it('round-trips: TTE at a record power returns that record duration', () => {
    const curve = fitEnduranceCurve([short, medium, long])!
    expect(computeTTE(short.watts, curve)).toBeCloseTo(300, 0)
    expect(computeTTE(medium.watts, curve)).toBeCloseTo(1200, 0)
  })

  it('gives a longer TTE for a lower target power', () => {
    const curve = fitEnduranceCurve([short, medium, long])!
    const tteEasy = computeTTE(100, curve)!
    const tteHard = computeTTE(250, curve)!
    expect(tteEasy).toBeGreaterThan(tteHard)
  })

  it('returns null for a non-positive target power', () => {
    const curve = fitEnduranceCurve([short, medium, long])!
    expect(computeTTE(0, curve)).toBeNull()
    expect(computeTTE(-100, curve)).toBeNull()
  })
})

describe('checkRiegelValidityDomain', () => {
  it('is within domain for the sourced ~3.5-230min range (210s-13800s)', () => {
    expect(checkRiegelValidityDomain(210).withinValidityDomain).toBe(true)
    expect(checkRiegelValidityDomain(13800).withinValidityDomain).toBe(true)
    expect(checkRiegelValidityDomain(1200).withinValidityDomain).toBe(true) // 20 min, bien dans la plage
  })

  it('flags durations outside the domain without hiding the value — the source says "warn", not "refuse"', () => {
    expect(checkRiegelValidityDomain(30).withinValidityDomain).toBe(false) // 30s, sprint
    expect(checkRiegelValidityDomain(20000).withinValidityDomain).toBe(false) // ~5h33, ultra
  })

  it('echoes the input seconds unchanged', () => {
    expect(checkRiegelValidityDomain(999).seconds).toBe(999)
  })
})

describe('recordsOutsideValidityDomain', () => {
  it('returns only the records whose duration falls outside the sourced domain', () => {
    const records = [
      { seconds: 10, watts: 900 }, // sprint, hors domaine
      { seconds: 1200, watts: 260 }, // 20min, dans le domaine
      { seconds: 18000, watts: 150 }, // 5h, hors domaine
    ]
    expect(recordsOutsideValidityDomain(records)).toEqual([
      { seconds: 10, watts: 900 },
      { seconds: 18000, watts: 150 },
    ])
  })

  it('returns an empty array when every record is within domain', () => {
    expect(recordsOutsideValidityDomain([{ seconds: 300, watts: 300 }, { seconds: 1200, watts: 250 }])).toEqual([])
  })
})

describe('difficultyRatio', () => {
  const curve: EnduranceCurve = { a: 300, e: 0.1, enduranceIndex: 0.9 }

  it('is close to 1 when the session duration matches the TTE at that power', () => {
    const tte = computeTTE(200, curve)!
    expect(difficultyRatio(tte, 200, curve)).toBeCloseTo(1, 5)
  })

  it('is well below 1 for an easy, short effort at that power', () => {
    const tte = computeTTE(200, curve)!
    expect(difficultyRatio(tte / 4, 200, curve)).toBeCloseTo(0.25, 5)
  })

  it('returns null when TTE is not computable', () => {
    expect(difficultyRatio(600, 0, curve)).toBeNull()
  })
})

describe('fallbackFatigueExponent', () => {
  // Le garde-fou demandé explicitement : jamais de valeur inventée tant
  // que R12 n'a pas été extrait du papier source pour le cyclisme.
  it('always throws today — RIEGEL_CYCLING_FATIGUE_EXPONENT is still pending', () => {
    expect(() => fallbackFatigueExponent()).toThrowError(/R12/)
  })
})
