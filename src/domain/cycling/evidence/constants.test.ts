import { describe, it, expect } from 'vitest'
import {
  requireConstant,
  IMPULSE_RESPONSE_WINDOWS,
  GOVERNOR_BASELINE_WINDOW,
  KJ_DURABILITY_THRESHOLDS,
  TEN_HAAF_COEFFICIENTS,
  W_PRIME_RECONSTITUTION_CONSTANT,
  RIEGEL_CYCLING_FATIGUE_EXPONENT,
  type PendingConstant,
} from './constants'

describe('requireConstant — garde-fou principal', () => {
  // C'est LE garde-fou demandé explicitement : "toute constante pending
  // doit faire échouer bruyamment le calcul qui en dépend... jamais
  // retourner une valeur par défaut silencieuse."
  it('throws, naming the source to consult, when reading a pending constant', () => {
    const pending: PendingConstant = { status: 'pending', sourceToConsult: 'R99 — Exemple (2099), Journal X' }
    expect(() => requireConstant(pending, 'Constante exemple')).toThrowError(/R99 — Exemple \(2099\), Journal X/)
    expect(() => requireConstant(pending, 'Constante exemple')).toThrowError(/Constante exemple/)
  })

  it('never returns undefined or a falsy default for a pending constant — it always throws', () => {
    const pending: PendingConstant = { status: 'pending', sourceToConsult: 'R99' }
    expect(() => requireConstant(pending, 'x')).toThrow()
  })

  it('returns the value straight through for a sourced constant', () => {
    expect(requireConstant(KJ_DURABILITY_THRESHOLDS, 'kJ durability thresholds')).toBe(KJ_DURABILITY_THRESHOLDS.value)
  })

  it('returns the value straight through for a convention constant', () => {
    expect(requireConstant(IMPULSE_RESPONSE_WINDOWS, 'IR windows')).toBe(IMPULSE_RESPONSE_WINDOWS.value)
    expect(requireConstant(GOVERNOR_BASELINE_WINDOW, 'governor baseline')).toBe(GOVERNOR_BASELINE_WINDOW.value)
  })
})

describe('the three constants required at launch (Annexe B) are still pending', () => {
  // Regression guard, pas une interdiction — le jour où l'utilisateur les
  // remplit depuis les papiers sources, ce test doit être mis à jour en
  // même temps (status passera à 'sourced'), pas silencieusement contourné.
  it('Ten-Haaf coefficients', () => {
    expect(TEN_HAAF_COEFFICIENTS.status).toBe('pending')
    expect(() => requireConstant(TEN_HAAF_COEFFICIENTS, 'Ten-Haaf')).toThrowError(/R33/)
  })

  it("W′ reconstitution constant", () => {
    expect(W_PRIME_RECONSTITUTION_CONSTANT.status).toBe('pending')
    expect(() => requireConstant(W_PRIME_RECONSTITUTION_CONSTANT, "W′")).toThrowError(/R15/)
  })

  it('Riegel cycling fatigue exponent', () => {
    expect(RIEGEL_CYCLING_FATIGUE_EXPONENT.status).toBe('pending')
    expect(() => requireConstant(RIEGEL_CYCLING_FATIGUE_EXPONENT, 'Riegel cyclisme')).toThrowError(/R12/)
  })
})

describe('GOVERNOR_BASELINE_WINDOW', () => {
  it('is aligned on 28 days per the ≥4-week principle (docs/OPEN_QUESTIONS.md Q3)', () => {
    expect(GOVERNOR_BASELINE_WINDOW.value.baselineDays).toBe(28)
  })
})

describe('KJ_DURABILITY_THRESHOLDS', () => {
  it('is sourced from R08, R10 and R11', () => {
    expect(KJ_DURABILITY_THRESHOLDS.refs.sort()).toEqual(['R08', 'R10', 'R11'])
  })

  it('matches the exact numbers documented in the specification', () => {
    const v = KJ_DURABILITY_THRESHOLDS.value
    expect(v.firstMeasurableDeclineKJPerKg).toBe(10)
    expect(v.proDegradationKJPerKg).toBe(40)
    expect(v.womenDivergenceStartKJPerKg).toBe(20)
    expect(v.womenDivergenceAmplifiesKJPerKg).toBe(30)
  })
})
