import { describe, it, expect } from 'vitest'
import {
  requireConstant,
  IMPULSE_RESPONSE_WINDOWS,
  GOVERNOR_BASELINE_WINDOW,
  KJ_DURABILITY_THRESHOLDS,
  TEN_HAAF_COEFFICIENTS,
  W_PRIME_RECONSTITUTION_CONSTANT,
  RIEGEL_CYCLING_FATIGUE_EXPONENT,
  KJ_TARGET_NUDGE,
  RIEGEL_VALIDITY_DOMAIN,
  CARB_INTAKE_GUIDANCE,
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

describe('the two constants still required at launch (Annexe B) remain pending', () => {
  // Regression guard, pas une interdiction — le jour où l'utilisateur les
  // remplit depuis les papiers sources, ce test doit être mis à jour en
  // même temps (status passera à 'sourced'), pas silencieusement contourné.
  it("W′ reconstitution constant", () => {
    expect(W_PRIME_RECONSTITUTION_CONSTANT.status).toBe('pending')
    expect(() => requireConstant(W_PRIME_RECONSTITUTION_CONSTANT, "W′")).toThrowError(/R15/)
  })

  it('Riegel cycling fatigue exponent', () => {
    expect(RIEGEL_CYCLING_FATIGUE_EXPONENT.status).toBe('pending')
    expect(() => requireConstant(RIEGEL_CYCLING_FATIGUE_EXPONENT, 'Riegel cyclisme')).toThrowError(/R12/)
  })
})

describe('TEN_HAAF_COEFFICIENTS', () => {
  it('is sourced from R33', () => {
    expect(TEN_HAAF_COEFFICIENTS.status).toBe('sourced')
    expect(TEN_HAAF_COEFFICIENTS.refs).toEqual(['R33'])
  })

  it('matches the published body-mass variant (kJ/day)', () => {
    const v = TEN_HAAF_COEFFICIENTS.value.bodyMass
    expect(v.weightKJPerKg).toBe(49.94)
    expect(v.heightKJPerM).toBe(2459.053)
    expect(v.ageKJPerYear).toBe(34.014)
    expect(v.maleKJ).toBe(799.257)
    expect(v.constantKJ).toBe(122.502)
  })

  it('matches the published fat-free-mass variant (kJ/day)', () => {
    const v = TEN_HAAF_COEFFICIENTS.value.fatFreeMass
    expect(v.fatFreeMassKJPerKg).toBe(95.272)
    expect(v.constantKJ).toBe(2026.161)
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

describe('KJ_TARGET_NUDGE', () => {
  it('is explicitly a convention, not a sourced scientific constant — no Rxx pretends to fix a weekly nudge rate', () => {
    expect(KJ_TARGET_NUDGE.status).toBe('convention')
  })

  it('carries over the exact rate already in production (load-types.ts computeTargetKJ)', () => {
    expect(KJ_TARGET_NUDGE.value.greenPct).toBe(8)
    expect(KJ_TARGET_NUDGE.value.redPct).toBe(-12)
  })
})

describe('RIEGEL_VALIDITY_DOMAIN', () => {
  it('is sourced from R12', () => {
    expect(RIEGEL_VALIDITY_DOMAIN.refs).toEqual(['R12'])
  })

  it('matches ~3.5 to 230 minutes, in seconds', () => {
    expect(RIEGEL_VALIDITY_DOMAIN.value.minSeconds).toBe(210)
    expect(RIEGEL_VALIDITY_DOMAIN.value.maxSeconds).toBe(13800)
  })
})

describe('CARB_INTAKE_GUIDANCE', () => {
  it('is sourced from R34', () => {
    expect(CARB_INTAKE_GUIDANCE.refs).toEqual(['R34'])
  })

  it('matches the 120g/h ceiling and the ~1:0.8 glucose:fructose ratio', () => {
    expect(CARB_INTAKE_GUIDANCE.value.maxGramsPerHour).toBe(120)
    expect(CARB_INTAKE_GUIDANCE.value.glucoseFructoseRatio).toEqual([1, 0.8])
  })
})
