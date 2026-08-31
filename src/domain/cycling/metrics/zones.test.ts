import { describe, it, expect } from 'vitest'
import { computePowerZoneDistribution7, to3ZoneDistribution, lowIntensityPct, POWER_ZONES_7, POWER_ZONES_3 } from './zones'

describe('computePowerZoneDistribution7', () => {
  it('buckets each watt sample into its Coggan zone (%FTP)', () => {
    const ftp = 200
    // 50% -> zone1, 65% -> zone2, 80% -> zone3, 95% -> zone4, 110% -> zone5, 130% -> zone6, 160% -> zone7
    const watts = [100, 130, 160, 190, 220, 260, 320]
    const buckets = computePowerZoneDistribution7(watts, ftp)!
    expect(buckets.map((b) => b.seconds)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('returns null without a watts stream', () => {
    expect(computePowerZoneDistribution7(undefined, 200)).toBeNull()
    expect(computePowerZoneDistribution7([], 200)).toBeNull()
  })

  it('returns null without a known FTP', () => {
    expect(computePowerZoneDistribution7([100, 150], null)).toBeNull()
    expect(computePowerZoneDistribution7([100, 150], 0)).toBeNull()
  })

  it('covers every zone up to zone 7 with no upper bound', () => {
    expect(POWER_ZONES_7).toHaveLength(7)
    expect(POWER_ZONES_7[6].maxPct).toBeNull()
  })
})

describe('to3ZoneDistribution', () => {
  it('groups Coggan zones 1-2 into zone1, 3-4 into zone2, 5-7 into zone3', () => {
    expect(POWER_ZONES_3.find((z) => z.id === 'zone1')?.cogganZones).toEqual([1, 2])
    expect(POWER_ZONES_3.find((z) => z.id === 'zone2')?.cogganZones).toEqual([3, 4])
    expect(POWER_ZONES_3.find((z) => z.id === 'zone3')?.cogganZones).toEqual([5, 6, 7])
  })

  it('sums seconds correctly across the grouped zones', () => {
    const sevenZone = POWER_ZONES_7.map((z) => ({ zone: z.zone, label: z.label, seconds: z.zone * 100 }))
    // zone1 = z1+z2 = 100+200=300 ; zone2 = z3+z4 = 300+400=700 ; zone3 = z5+z6+z7 = 500+600+700=1800
    const threeZone = to3ZoneDistribution(sevenZone)
    expect(threeZone.find((z) => z.id === 'zone1')?.seconds).toBe(300)
    expect(threeZone.find((z) => z.id === 'zone2')?.seconds).toBe(700)
    expect(threeZone.find((z) => z.id === 'zone3')?.seconds).toBe(1800)
  })

  it('preserves the total time — no seconds lost or duplicated in the regrouping', () => {
    const sevenZone = POWER_ZONES_7.map((z) => ({ zone: z.zone, label: z.label, seconds: 60 }))
    const total7 = sevenZone.reduce((sum, b) => sum + b.seconds, 0)
    const total3 = to3ZoneDistribution(sevenZone).reduce((sum, b) => sum + b.seconds, 0)
    expect(total3).toBe(total7)
  })
})

describe('lowIntensityPct', () => {
  it('computes the % of time in zone1 relative to the total', () => {
    const buckets = [
      { id: 'zone1' as const, label: 'Basse intensité', seconds: 800 },
      { id: 'zone2' as const, label: 'Intensité modérée', seconds: 150 },
      { id: 'zone3' as const, label: 'Haute intensité', seconds: 50 },
    ]
    expect(lowIntensityPct(buckets)).toBeCloseTo(80, 5)
  })

  it('returns null when there is no time recorded at all', () => {
    const buckets = [
      { id: 'zone1' as const, label: 'Basse intensité', seconds: 0 },
      { id: 'zone2' as const, label: 'Intensité modérée', seconds: 0 },
      { id: 'zone3' as const, label: 'Haute intensité', seconds: 0 },
    ]
    expect(lowIntensityPct(buckets)).toBeNull()
  })
})
