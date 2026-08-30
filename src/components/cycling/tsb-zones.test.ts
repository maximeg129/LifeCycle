import { describe, it, expect } from 'vitest'
import { tsbZone, TSB_ZONES_ORDERED } from './tsb-zones'

describe('tsbZone', () => {
  it('classifies deep into each zone correctly', () => {
    expect(tsbZone(30).id).toBe('transition')
    expect(tsbZone(10).id).toBe('fresh')
    expect(tsbZone(0).id).toBe('grey')
    expect(tsbZone(-20).id).toBe('optimal')
    expect(tsbZone(-40).id).toBe('high-risk')
  })

  it('places the boundary values in the lower zone (thresholds are exclusive on the lower zone side)', () => {
    // Mirrors Intervals.icu's own Form chart bands: 20 / 5 / -10 / -30.
    expect(tsbZone(20).id).toBe('fresh')
    expect(tsbZone(5).id).toBe('grey')
    expect(tsbZone(-10).id).toBe('optimal')
    expect(tsbZone(-30).id).toBe('high-risk')
  })

  it('handles values just above and below each boundary', () => {
    expect(tsbZone(20.1).id).toBe('transition')
    expect(tsbZone(19.9).id).toBe('fresh')
    expect(tsbZone(5.1).id).toBe('fresh')
    expect(tsbZone(4.9).id).toBe('grey')
    expect(tsbZone(-9.9).id).toBe('grey')
    expect(tsbZone(-10.1).id).toBe('optimal')
    expect(tsbZone(-29.9).id).toBe('optimal')
    expect(tsbZone(-30.1).id).toBe('high-risk')
  })
})

describe('TSB_ZONES_ORDERED', () => {
  it('lists all 5 zones from highest (Transition) to lowest (Risque élevé)', () => {
    expect(TSB_ZONES_ORDERED.map((z) => z.id)).toEqual(['transition', 'fresh', 'grey', 'optimal', 'high-risk'])
  })
})
