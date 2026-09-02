import { describe, it, expect } from 'vitest'
import {
  average,
  computeNormalizedPower,
  computePowerZoneDistribution,
  computeHrZoneDistribution,
  computeSplitAnalysis,
  summarizeDurabilityForDisplay,
  type DurabilityRideEntry,
} from './ride-analysis-types'

describe('average', () => {
  it('averages finite values and ignores NaN', () => {
    expect(average([100, 200, NaN, 300])).toBe(200)
  })

  it('returns null when nothing is valid', () => {
    expect(average([])).toBeNull()
    expect(average([NaN, NaN])).toBeNull()
  })
})

describe('computeNormalizedPower', () => {
  it('returns null for a stream shorter than the 30s window', () => {
    expect(computeNormalizedPower(Array(20).fill(200))).toBeNull()
  })

  it('equals the flat power for a perfectly steady effort', () => {
    const steady = Array(120).fill(200)
    expect(computeNormalizedPower(steady)).toBe(200)
  })

  it('is higher than the simple average for a variable effort (a sustained surge, not just noise)', () => {
    // 60s steady at 100W then 60s steady at 300W — same simple average as a
    // flat 200W ride, but each half is long enough to survive the 30s
    // rolling-average smoothing, so NP should come out meaningfully higher.
    const surge = [...Array(60).fill(100), ...Array(60).fill(300)]
    const np = computeNormalizedPower(surge)
    expect(np).not.toBeNull()
    expect(np as number).toBeGreaterThan(200)
  })

  it('smooths out second-to-second noise the 30s window discounts', () => {
    // Alternating 100W/300W every single second averages to a flat 200W
    // once the 30s rolling window is applied — the whole point of NP is to
    // discount exactly this kind of instantaneous power-meter noise.
    const noisy = Array.from({ length: 120 }, (_, i) => (i % 2 === 0 ? 100 : 300))
    expect(computeNormalizedPower(noisy)).toBe(200)
  })
})

describe('computePowerZoneDistribution', () => {
  it('returns null without a watts stream or FTP', () => {
    expect(computePowerZoneDistribution(undefined, 250)).toBeNull()
    expect(computePowerZoneDistribution([100, 200], null)).toBeNull()
    expect(computePowerZoneDistribution([100, 200], 0)).toBeNull()
  })

  it('buckets seconds by % of FTP', () => {
    // FTP 200: 100W = 50% (Z1), 130W = 65% (Z2), 250W = 125% (Z6)
    const zones = computePowerZoneDistribution([100, 130, 250], 200)!
    expect(zones.find((z) => z.zone === 1)?.seconds).toBe(1)
    expect(zones.find((z) => z.zone === 2)?.seconds).toBe(1)
    expect(zones.find((z) => z.zone === 6)?.seconds).toBe(1)
    expect(zones.reduce((s, z) => s + z.seconds, 0)).toBe(3)
  })

  it('ignores negative/non-finite samples (stream gaps)', () => {
    const zones = computePowerZoneDistribution([100, NaN, -5], 200)!
    expect(zones.reduce((s, z) => s + z.seconds, 0)).toBe(1)
  })
})

describe('computeHrZoneDistribution', () => {
  it('returns null without a heartrate stream or max HR', () => {
    expect(computeHrZoneDistribution(undefined, 180)).toBeNull()
    expect(computeHrZoneDistribution([120, 150], null)).toBeNull()
  })

  it('buckets seconds by % of max HR', () => {
    // maxHr 180: 90bpm = 50% (Z1), 162bpm = 90% (Z5)
    const zones = computeHrZoneDistribution([90, 162], 180)!
    expect(zones.find((z) => z.zone === 1)?.seconds).toBe(1)
    expect(zones.find((z) => z.zone === 5)?.seconds).toBe(1)
  })
})

describe('computeSplitAnalysis', () => {
  it('returns null for a stream shorter than 60 samples', () => {
    expect(computeSplitAnalysis(Array(30).fill(200))).toBeNull()
  })

  it('detects a positive split (faded in the second half)', () => {
    const watts = [...Array(60).fill(250), ...Array(60).fill(180)]
    const split = computeSplitAnalysis(watts)!
    expect(split.fade).toBe('positive')
    expect(split.firstHalfAvgWatts).toBe(250)
    expect(split.secondHalfAvgWatts).toBe(180)
  })

  it('detects a negative split (accelerated in the second half)', () => {
    const watts = [...Array(60).fill(180), ...Array(60).fill(250)]
    expect(computeSplitAnalysis(watts)!.fade).toBe('negative')
  })

  it('calls a small (<5%) difference even pacing', () => {
    const watts = [...Array(60).fill(200), ...Array(60).fill(195)]
    expect(computeSplitAnalysis(watts)!.fade).toBe('even')
  })
})

describe('summarizeDurabilityForDisplay', () => {
  it('returns null without a durability profile', () => {
    expect(summarizeDurabilityForDisplay(null)).toBeNull()
  })

  it('returns null when the fresh (0 kJ/kg) tier has no 5min MMP', () => {
    const durability: DurabilityRideEntry[] = [
      { tierKJPerKg: 0, reached: true, mmp: [{ durationSeconds: 60, watts: 250 }] },
      { tierKJPerKg: 20, reached: true, mmp: [{ durationSeconds: 300, watts: 220 }] },
    ]
    expect(summarizeDurabilityForDisplay(durability)).toBeNull()
  })

  it('returns null when no fatigue tier was reached', () => {
    const durability: DurabilityRideEntry[] = [
      { tierKJPerKg: 0, reached: true, mmp: [{ durationSeconds: 300, watts: 250 }] },
      { tierKJPerKg: 20, reached: false, mmp: [] },
    ]
    expect(summarizeDurabilityForDisplay(durability)).toBeNull()
  })

  it('computes % degradation vs the fresh tier at 5min for each reached fatigue tier', () => {
    const durability: DurabilityRideEntry[] = [
      { tierKJPerKg: 0, reached: true, mmp: [{ durationSeconds: 300, watts: 250 }] },
      { tierKJPerKg: 10, reached: true, mmp: [{ durationSeconds: 300, watts: 237.5 }] }, // -5%
      { tierKJPerKg: 20, reached: true, mmp: [{ durationSeconds: 300, watts: 225 }] }, // -10%
      { tierKJPerKg: 30, reached: false, mmp: [] }, // never reached — excluded
    ]
    const rows = summarizeDurabilityForDisplay(durability)!
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ tierKJPerKg: 10, watts: 238, deltaPctVsFresh: -5 })
    expect(rows[1]).toEqual({ tierKJPerKg: 20, watts: 225, deltaPctVsFresh: -10 })
  })

  it('skips a reached tier that has no 5min MMP (segment too short after that point)', () => {
    const durability: DurabilityRideEntry[] = [
      { tierKJPerKg: 0, reached: true, mmp: [{ durationSeconds: 300, watts: 250 }] },
      { tierKJPerKg: 40, reached: true, mmp: [{ durationSeconds: 60, watts: 200 }] }, // no 300s entry
    ]
    expect(summarizeDurabilityForDisplay(durability)).toBeNull()
  })
})
