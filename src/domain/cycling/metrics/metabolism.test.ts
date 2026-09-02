import { describe, it, expect } from 'vitest'
import { computeRestingMetabolicRate } from './metabolism'

describe('computeRestingMetabolicRate', () => {
  it('computes the body-mass variant (weight/height/age/sex) for a man', () => {
    const result = computeRestingMetabolicRate({ weightKg: 70, heightCm: 175, age: 30, sex: 'male' })
    expect(result).toEqual({ kcalPerDay: 1840, method: 'ten-haaf-body-mass' })
  })

  it('computes the body-mass variant for a woman (no male term added)', () => {
    const result = computeRestingMetabolicRate({ weightKg: 60, heightCm: 165, age: 25, sex: 'female' })
    expect(result).toEqual({ kcalPerDay: 1512, method: 'ten-haaf-body-mass' })
  })

  it('prefers the fat-free-mass variant when fatFreeMassKg is provided', () => {
    // Same weight/height/age/sex as the first case, but with a known FFM —
    // the dedicated FFM equation (more precise per R33) takes over, ignoring
    // the body-mass inputs entirely.
    const result = computeRestingMetabolicRate({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', fatFreeMassKg: 58 })
    expect(result).toEqual({ kcalPerDay: 1805, method: 'ten-haaf-fat-free-mass' })
  })

  it('falls back to the body-mass variant when fatFreeMassKg is null', () => {
    const result = computeRestingMetabolicRate({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', fatFreeMassKg: null })
    expect(result.method).toBe('ten-haaf-body-mass')
  })

  it('falls back to the body-mass variant when fatFreeMassKg is not positive', () => {
    const result = computeRestingMetabolicRate({ weightKg: 70, heightCm: 175, age: 30, sex: 'male', fatFreeMassKg: 0 })
    expect(result.method).toBe('ten-haaf-body-mass')
  })
})
