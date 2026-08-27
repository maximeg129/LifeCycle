import { describe, it, expect } from 'vitest'
import { planKmDeltaUpdate, computeGearKmFromActivities } from './km-sync'

describe('planKmDeltaUpdate', () => {
  it('picks the mounted chain when the bike has rotation chains', () => {
    const chains = [
      { id: 'a', status: 'stockage' },
      { id: 'b', status: 'montee' },
    ]
    const plan = planKmDeltaUpdate([], chains)
    expect(plan.chainToUpdate).toEqual({ id: 'b', status: 'montee' })
  })

  it('has no chain to update when none is mounted', () => {
    const chains = [{ id: 'a', status: 'stockage' }, { id: 'b', status: 'retiree' }]
    expect(planKmDeltaUpdate([], chains).chainToUpdate).toBeNull()
  })

  it('has no chain to update when the bike has no rotation chains at all', () => {
    expect(planKmDeltaUpdate([], []).chainToUpdate).toBeNull()
  })

  it('excludes a generic chain component when a dedicated rotation chain covers this bike', () => {
    const components = [
      { id: 'comp-chain', category: 'chain' },
      { id: 'comp-cassette', category: 'cassette' },
    ]
    const chains = [{ id: 'chain-1', status: 'montee' }]
    const plan = planKmDeltaUpdate(components, chains)
    expect(plan.componentsToUpdate.map((c) => c.id)).toEqual(['comp-cassette'])
  })

  it('keeps a generic chain component when the bike has no rotation chains', () => {
    const components = [
      { id: 'comp-chain', category: 'chain' },
      { id: 'comp-cassette', category: 'cassette' },
    ]
    const plan = planKmDeltaUpdate(components, [])
    expect(plan.componentsToUpdate.map((c) => c.id)).toEqual(['comp-chain', 'comp-cassette'])
  })

  it('never drops a mounted chain update just because the bike also has ordinary components', () => {
    // Regression: the manual-km-edit path used to update components but silently
    // skip the mounted chain entirely — this is the exact case that should catch it.
    const components = [{ id: 'comp-cassette', category: 'cassette' }]
    const chains = [{ id: 'chain-1', status: 'montee' }]
    const plan = planKmDeltaUpdate(components, chains)
    expect(plan.chainToUpdate).not.toBeNull()
    expect(plan.componentsToUpdate).toHaveLength(1)
  })
})

describe('computeGearKmFromActivities', () => {
  const gearId = 'b9419905'

  it('sums matching activities strictly after the cutoff date', () => {
    const activities = [
      { gear: { id: gearId }, start_date_local: '2026-08-20T10:00:00', distance: 40000 }, // before cutoff, excluded
      { gear: { id: gearId }, start_date_local: '2026-08-23T10:00:00', distance: 40000 }, // == cutoff, excluded
      { gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 30000 }, // after cutoff, included
      { gear: { id: gearId }, start_date_local: '2026-08-25T10:00:00', distance: 20000 }, // after cutoff, included
    ]
    expect(computeGearKmFromActivities(activities, gearId, '2026-08-23')).toBe(50) // (30000+20000)/1000
  })

  it('ignores activities tagged with a different gear', () => {
    const activities = [
      { gear: { id: 'other-bike' }, start_date_local: '2026-08-24T10:00:00', distance: 50000 },
      { gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 10000 },
    ]
    expect(computeGearKmFromActivities(activities, gearId, null)).toBe(10)
  })

  it('sums everything in the window on a first-ever sync (no cutoff)', () => {
    const activities = [
      { gear: { id: gearId }, start_date_local: '2026-06-01T10:00:00', distance: 100000 },
      { gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 25000 },
    ]
    expect(computeGearKmFromActivities(activities, gearId, null)).toBe(125)
  })

  it('ignores activities with no distance or zero distance', () => {
    const activities = [
      { gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00' },
      { gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 0 },
    ]
    expect(computeGearKmFromActivities(activities, gearId, null)).toBe(0)
  })

  it('ignores a flat gear_id field — Intervals.icu only ever nests it under gear.id', () => {
    // Regression: this is the actual bug that shipped — the API has no
    // top-level gear_id at all (requesting it via `fields=` is silently
    // ignored), so every activity looked gear-less and every gear total
    // came back 0, no matter how much history was fetched.
    const activities = [{ gear_id: gearId, start_date_local: '2026-08-24T10:00:00', distance: 45000 } as unknown as { gear?: { id?: string }; start_date_local?: string; distance?: number }]
    expect(computeGearKmFromActivities(activities, gearId, null)).toBe(0)
  })

  it("doesn't depend on any gear rollup field — only ever reads activities", () => {
    // Regression: Intervals.icu's own /athlete bikes[].distance sat tens of
    // thousands of km behind reality for gear whose rides sync directly from
    // Wahoo. This function never looks at that field at all.
    const activities = [{ gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 45000 }]
    expect(computeGearKmFromActivities(activities, gearId, '2026-08-01')).toBe(45)
  })
})
