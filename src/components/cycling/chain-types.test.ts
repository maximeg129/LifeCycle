import { describe, it, expect } from 'vitest'
import { computeWaxLevel, needsReplacementCheck, waxProgressPct, ridesSinceMount, type LinkedRide } from './chain-types'

describe('computeWaxLevel', () => {
  it('is ok well below the threshold', () => {
    expect(computeWaxLevel({ kmSinceWax: 100, waxThresholdKm: 250 })).toBe('ok')
  })
  it('is warning at 80% or above', () => {
    expect(computeWaxLevel({ kmSinceWax: 200, waxThresholdKm: 250 })).toBe('warning')
  })
  it('is critical at or beyond the threshold', () => {
    expect(computeWaxLevel({ kmSinceWax: 250, waxThresholdKm: 250 })).toBe('critical')
    expect(computeWaxLevel({ kmSinceWax: 300, waxThresholdKm: 250 })).toBe('critical')
  })
  it('is ok when there is no threshold set', () => {
    expect(computeWaxLevel({ kmSinceWax: 500, waxThresholdKm: 0 })).toBe('ok')
  })
})

describe('needsReplacementCheck', () => {
  it('flags once lifetime km reaches the replace threshold', () => {
    expect(needsReplacementCheck({ totalKm: 6999, replaceThresholdKm: 7000 })).toBe(false)
    expect(needsReplacementCheck({ totalKm: 7000, replaceThresholdKm: 7000 })).toBe(true)
  })
  it('never flags when no threshold is set', () => {
    expect(needsReplacementCheck({ totalKm: 999999, replaceThresholdKm: 0 })).toBe(false)
  })
})

describe('waxProgressPct', () => {
  it('computes a percentage capped at 100', () => {
    expect(waxProgressPct({ kmSinceWax: 125, waxThresholdKm: 250 })).toBe(50)
    expect(waxProgressPct({ kmSinceWax: 400, waxThresholdKm: 250 })).toBe(100)
  })
})

describe('ridesSinceMount', () => {
  const ride = (activityId: string, date: string, km: number): LinkedRide => ({ activityId, name: `Sortie ${activityId}`, date, km })

  it('keeps only rides on or after the mount date, newest first', () => {
    const linkedRides = [ride('a', '2026-08-10', 40), ride('b', '2026-08-25', 30), ride('c', '2026-08-22', 20)]
    const rides = ridesSinceMount({ linkedRides, mountedDate: '2026-08-20' })
    expect(rides.map((r) => r.activityId)).toEqual(['b', 'c'])
  })

  it('includes a ride landing exactly on the mount date', () => {
    const linkedRides = [ride('a', '2026-08-20', 40)]
    expect(ridesSinceMount({ linkedRides, mountedDate: '2026-08-20' })).toHaveLength(1)
  })

  it('returns nothing when the chain has never been mounted', () => {
    const linkedRides = [ride('a', '2026-08-20', 40)]
    expect(ridesSinceMount({ linkedRides, mountedDate: null })).toEqual([])
  })

  it('defaults to an empty list for a chain created before linkedRides existed', () => {
    expect(ridesSinceMount({ linkedRides: undefined, mountedDate: '2026-08-01' })).toEqual([])
  })
})
