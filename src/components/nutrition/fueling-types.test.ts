import { describe, it, expect } from 'vitest'
import { sessionEnergyBurnedKcal, totalEnergyBurnedKcal, recoveryGap, proteinTargetRange } from './fueling-types'

describe('sessionEnergyBurnedKcal', () => {
  it('uses the kJ≈kcal rule of thumb when power data is available', () => {
    expect(sessionEnergyBurnedKcal({ average_watts: 200, moving_time: 3600 })).toBe(720)
  })
  it('prefers weighted average power', () => {
    expect(sessionEnergyBurnedKcal({ average_watts: 200, weighted_average_watts: 210, moving_time: 3600 })).toBe(756)
  })
  it('falls back to a MET×weight estimate without power data', () => {
    // 1h, moderate intensity (MET 8), 70kg → 560 kcal
    expect(sessionEnergyBurnedKcal({ moving_time: 3600, icu_intensity: 60 }, 70)).toBe(560)
  })
  it('is null with neither power nor a known bodyweight', () => {
    expect(sessionEnergyBurnedKcal({ moving_time: 3600 })).toBeNull()
  })
})

describe('totalEnergyBurnedKcal', () => {
  it('sums across sessions, skipping unresolvable ones', () => {
    const total = totalEnergyBurnedKcal([
      { average_watts: 200, moving_time: 3600 }, // 720
      { moving_time: 1800 }, // unresolvable, no weight given
    ])
    expect(total).toBe(720)
  })
})

describe('recoveryGap', () => {
  it('is eaten minus burned', () => {
    expect(recoveryGap(2500, 2000)).toBe(500)
    expect(recoveryGap(1800, 2200)).toBe(-400)
  })
})

describe('proteinTargetRange', () => {
  it('scales 1.6-2.0 g/kg to bodyweight', () => {
    expect(proteinTargetRange(70)).toEqual({ min: 112, max: 140 })
  })
})
