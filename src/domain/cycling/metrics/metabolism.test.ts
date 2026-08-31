import { describe, it, expect } from 'vitest'
import { computeRestingMetabolicRate } from './metabolism'

describe('computeRestingMetabolicRate', () => {
  // Le garde-fou demandé explicitement : jamais de calcul (ni Ten-Haaf
  // approximé, ni un repli sur une équation non sourcée comme Mifflin-St
  // Jeor) tant que TEN_HAAF_COEFFICIENTS (R33) n'a pas été extraite du
  // papier source.
  it('always throws today — TEN_HAAF_COEFFICIENTS is still pending', () => {
    expect(() => computeRestingMetabolicRate({ weightKg: 70 })).toThrowError(/R33/)
  })

  it('throws the same way whether or not fat-free mass is supplied', () => {
    expect(() => computeRestingMetabolicRate({ weightKg: 70, fatFreeMassKg: 58 })).toThrowError(/R33/)
    expect(() => computeRestingMetabolicRate({ weightKg: 70, fatFreeMassKg: null })).toThrowError(/R33/)
  })

  it('names the constant in the error, per the requireConstant contract', () => {
    expect(() => computeRestingMetabolicRate({ weightKg: 70 })).toThrowError(/TEN_HAAF_COEFFICIENTS/)
  })
})
