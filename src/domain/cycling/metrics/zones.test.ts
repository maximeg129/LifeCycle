import { describe, it, expect } from 'vitest'
import { computePowerZoneDistribution7, computePowerZoneDistribution3, lowIntensityPct, POWER_ZONES_7, POWER_ZONES_3 } from './zones'

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

describe('computePowerZoneDistribution3', () => {
  // Bornes S02 (docs/OPEN_QUESTIONS.md Q5) : zone1 <80%, zone2 80-100%, zone3 100%+.
  it('buckets each watt sample into its Seiler 3-zone bucket (%FTP)', () => {
    const ftp = 200
    const watts = [100, 150, 170, 200, 250] // 50%, 75%, 85%, 100%, 125%
    const buckets = computePowerZoneDistribution3(watts, ftp)!
    expect(buckets.find((b) => b.id === 'zone1')?.seconds).toBe(2) // 50%, 75%
    expect(buckets.find((b) => b.id === 'zone2')?.seconds).toBe(1) // 85%
    expect(buckets.find((b) => b.id === 'zone3')?.seconds).toBe(2) // 100%, 125%
  })

  it('returns null without a watts stream or a known FTP', () => {
    expect(computePowerZoneDistribution3(undefined, 200)).toBeNull()
    expect(computePowerZoneDistribution3([100], null)).toBeNull()
  })

  it('has exactly 3 zones, matching the boundaries decided for Q5 (50/80/100 reading)', () => {
    expect(POWER_ZONES_3).toHaveLength(3)
    expect(POWER_ZONES_3[0].maxPct).toBe(80)
    expect(POWER_ZONES_3[1].minPct).toBe(80)
    expect(POWER_ZONES_3[1].maxPct).toBe(100)
    expect(POWER_ZONES_3[2].minPct).toBe(100)
    expect(POWER_ZONES_3[2].maxPct).toBeNull()
  })

  it('preserves the total time — every sample lands in exactly one zone', () => {
    const ftp = 250
    const watts = [50, 100, 150, 200, 250, 300, 350, 400]
    const buckets = computePowerZoneDistribution3(watts, ftp)!
    const total = buckets.reduce((sum, b) => sum + b.seconds, 0)
    expect(total).toBe(watts.length)
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
