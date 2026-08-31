import { describe, it, expect } from 'vitest'
import { arbitrateSession, type ArbitrationInput } from './sessionArbiter'

function baseInput(overrides: Partial<ArbitrationInput> = {}): ArbitrationInput {
  return {
    hrvStatus: 'within-or-above-baseline',
    wellbeingStatus: 'normal',
    consecutiveSleepRestrictionNights: 0,
    consecutiveRestDaysRecommended: 0,
    ...overrides,
  }
}

describe('arbitrateSession — cas 1 (nominal)', () => {
  it('recommends the planned session when everything is normal', () => {
    const result = arbitrateSession(baseInput())
    expect(result.decision).toBe('planned-session')
    expect(result.matchedCaseId).toBe('arbitration-nominal-case')
  })

  it('also lands on nominal with exactly 1 restricted night (below the ≥2 threshold)', () => {
    const result = arbitrateSession(baseInput({ consecutiveSleepRestrictionNights: 1 }))
    expect(result.decision).toBe('planned-session')
    expect(result.matchedCaseId).toBe('arbitration-nominal-case')
  })
})

describe('arbitrateSession — cas 2 (bien-être dégradé prime)', () => {
  it('recommends low intensity when wellbeing is degraded despite normal HRV', () => {
    const result = arbitrateSession(baseInput({ wellbeingStatus: 'degraded' }))
    expect(result.decision).toBe('low-intensity')
    expect(result.matchedCaseId).toBe('arbitration-wellbeing-overrides')
  })

  it('never carries a reassessInHours (that is specific to case 3)', () => {
    const result = arbitrateSession(baseInput({ wellbeingStatus: 'degraded' }))
    expect(result.reassessInHours).toBeUndefined()
  })
})

describe('arbitrateSession — cas 3 (HRV basse isolée, réévaluation 48h)', () => {
  it('recommends low intensity with a 48h reassessment when only HRV is low', () => {
    const result = arbitrateSession(baseInput({ hrvStatus: 'below-low-limit' }))
    expect(result.decision).toBe('low-intensity')
    expect(result.matchedCaseId).toBe('arbitration-low-hrv-reassess-48h')
    expect(result.reassessInHours).toBe(48)
  })
})

describe('arbitrateSession — cas 4 (restriction de sommeil ≥2 nuits prime sur tout)', () => {
  it('recommends low intensity at exactly 2 restricted nights, even with every other signal normal', () => {
    const result = arbitrateSession(baseInput({ consecutiveSleepRestrictionNights: 2 }))
    expect(result.decision).toBe('low-intensity')
    expect(result.matchedCaseId).toBe('arbitration-sleep-restriction-overrides-feeling-fresh')
  })

  it('overrides normal HRV and normal wellbeing — "quel que soit le reste des signaux"', () => {
    const result = arbitrateSession(
      baseInput({ consecutiveSleepRestrictionNights: 3, hrvStatus: 'within-or-above-baseline', wellbeingStatus: 'normal' })
    )
    expect(result.decision).toBe('low-intensity')
    expect(result.matchedCaseId).toBe('arbitration-sleep-restriction-overrides-feeling-fresh')
  })

  it('does NOT trigger at exactly 1 night — the threshold is ≥2, not ≥1', () => {
    const result = arbitrateSession(baseInput({ consecutiveSleepRestrictionNights: 1 }))
    expect(result.matchedCaseId).not.toBe('arbitration-sleep-restriction-overrides-feeling-fresh')
  })
})

describe('arbitrateSession — cas 5 (les 3 signaux dégradés, le plus sévère)', () => {
  it('recommends rest when HRV low + wellbeing degraded + sleep restricted all co-occur', () => {
    const result = arbitrateSession(
      baseInput({ hrvStatus: 'below-low-limit', wellbeingStatus: 'degraded', consecutiveSleepRestrictionNights: 1 })
    )
    expect(result.decision).toBe('rest')
    expect(result.matchedCaseId).toBe('arbitration-persistent-degradation-orients')
  })

  it('escalates to orient-to-professional once persistence exceeds 7 days', () => {
    const result = arbitrateSession(
      baseInput({
        hrvStatus: 'below-low-limit',
        wellbeingStatus: 'degraded',
        consecutiveSleepRestrictionNights: 1,
        consecutiveRestDaysRecommended: 8,
      })
    )
    expect(result.decision).toBe('orient-to-professional')
    expect(result.matchedCaseId).toBe('arbitration-persistent-degradation-orients')
  })

  it('does not escalate to orient at exactly 7 days — only strictly beyond', () => {
    const result = arbitrateSession(
      baseInput({
        hrvStatus: 'below-low-limit',
        wellbeingStatus: 'degraded',
        consecutiveSleepRestrictionNights: 1,
        consecutiveRestDaysRecommended: 7,
      })
    )
    expect(result.decision).toBe('rest')
  })

  it('takes priority over case 4 even with ≥2 restricted nights — the most severe combination wins', () => {
    const result = arbitrateSession(
      baseInput({ hrvStatus: 'below-low-limit', wellbeingStatus: 'degraded', consecutiveSleepRestrictionNights: 3 })
    )
    expect(result.matchedCaseId).toBe('arbitration-persistent-degradation-orients')
    expect(result.decision).toBe('rest')
  })

  it('requires all 3 dimensions degraded — 2 out of 3 falls through to a less severe case', () => {
    // HRV basse + bien-être dégradé, mais sommeil conforme -> cas 2 (bien-être prime), pas cas 5.
    const result = arbitrateSession(baseInput({ hrvStatus: 'below-low-limit', wellbeingStatus: 'degraded' }))
    expect(result.matchedCaseId).toBe('arbitration-wellbeing-overrides')
  })
})
