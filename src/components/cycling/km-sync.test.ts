import { describe, it, expect } from 'vitest'
import { planKmDeltaUpdate, computeGearKmFromActivities, computeGearSyncDelta, extractLinkedRides } from './km-sync'

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

describe('computeGearSyncDelta', () => {
  it('catches up the full history in one go on a first-ever sync (no baseline yet)', () => {
    // Bike created at 0 km, linked after months of riding already tracked
    // on Intervals.icu — same "catch up in one sync" intent already covered
    // by computeGearKmFromActivities's own first-sync test above.
    const plan = computeGearSyncDelta({ totalKm: 0 }, 1200)
    expect(plan).toEqual({ delta: 1200, newTotalKm: 1200, newBaselineKm: 1200 })
  })

  it('captures the baseline without crediting anything when totalKm already sits above what Intervals.icu tracks (the bug this fixes)', () => {
    // Real bug, caught live: a bike created with a manual real-world
    // odometer figure (5000 km) higher than what Intervals.icu has ever
    // tracked for its linked gear (800 km so far) — the OLD design compared
    // trueTotalKm straight against totalKm forever, so this bike (and its
    // mounted chain) would NEVER sync again, no matter how much new real
    // riding followed, since 800 < 5000 stays true until real riding closes
    // a 4200 km gap that was never about new riding in the first place.
    const plan = computeGearSyncDelta({ totalKm: 5000 }, 800)
    expect(plan).toEqual({ delta: 0, newTotalKm: 5000, newBaselineKm: 800 })
  })

  it('detects new real riding on the next sync via the baseline, even though totalKm never caught up to trueTotalKm', () => {
    // Continues the case above: the athlete then rides 40 km (Intervals.icu
    // now tracks 840 km for this gear). The stuck comparison against
    // totalKm (5000) would still show a negative delta forever — but
    // comparing against the baseline captured last sync (800) correctly
    // detects the 40 new km, and adds it ON TOP of the real-world totalKm
    // rather than discarding it.
    const plan = computeGearSyncDelta({ totalKm: 5000, gearSyncBaselineKm: 800 }, 840)
    expect(plan).toEqual({ delta: 40, newTotalKm: 5040, newBaselineKm: 840 })
  })

  it('reports nothing to credit once a baseline is already caught up and no new riding happened', () => {
    const plan = computeGearSyncDelta({ totalKm: 5040, gearSyncBaselineKm: 840 }, 840)
    expect(plan).toEqual({ delta: 0, newTotalKm: 5040, newBaselineKm: 840 })
  })

  it('treats a baseline of exactly 0 as already captured, not as "no baseline yet"', () => {
    // Loose-equality nullish check (`!= null`) — 0 is a legitimate baseline
    // (a bike whose gear had no tracked history at all when first linked),
    // must never be mistaken for "undefined" and re-trigger the one-time
    // catch-up-against-totalKm path a second time.
    const plan = computeGearSyncDelta({ totalKm: 0, gearSyncBaselineKm: 0 }, 30)
    expect(plan).toEqual({ delta: 30, newTotalKm: 30, newBaselineKm: 30 })
  })
})

// extractLinkedRides shares matchesGearSinceCutoff with computeGearKmFromActivities
// above (same file, same private predicate) — these tests focus on what's
// unique to it (shaping the matching activities into rides) rather than
// re-proving the match rule itself, already covered above. Which CHAIN these
// rides end up attributed to is planKmDeltaUpdate's job (tested above) —
// applyKmDeltaToBikeDependents just passes this list straight through to
// whichever chain that already picked, in the same updateDoc call as the km
// bump, so the two can't land on different chains.
describe('extractLinkedRides', () => {
  const gearId = 'b9419905'

  it('turns matching activities into linked rides, per-activity km rounded individually', () => {
    const activities = [
      { id: 'act-1', name: 'Sortie du matin', gear: { id: gearId }, start_date_local: '2026-08-24T10:00:00', distance: 30400 },
      { id: 'act-2', name: 'Sortie du soir', gear: { id: gearId }, start_date_local: '2026-08-25T18:00:00', distance: 20000 },
    ]
    expect(extractLinkedRides(activities, gearId, '2026-08-23')).toEqual([
      { activityId: 'act-1', name: 'Sortie du matin', date: '2026-08-24', km: 30 },
      { activityId: 'act-2', name: 'Sortie du soir', date: '2026-08-25', km: 20 },
    ])
  })

  it('excludes activities on a different gear or on/before the cutoff, same as the sum', () => {
    const activities = [
      { id: 'other-gear', gear: { id: 'other-bike' }, start_date_local: '2026-08-24T10:00:00', distance: 40000 },
      { id: 'before-cutoff', gear: { id: gearId }, start_date_local: '2026-08-20T10:00:00', distance: 40000 },
      { id: 'on-cutoff', gear: { id: gearId }, start_date_local: '2026-08-23T10:00:00', distance: 40000 },
    ]
    expect(extractLinkedRides(activities, gearId, '2026-08-23')).toEqual([])
  })

  it('falls back to null name and empty date when the activity is missing them', () => {
    const activities = [{ id: 'act-1', gear: { id: gearId }, distance: 15000 }]
    expect(extractLinkedRides(activities, gearId, null)).toEqual([
      { activityId: 'act-1', name: null, date: '', km: 15 },
    ])
  })
})
