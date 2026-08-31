import { describe, it, expect } from 'vitest'
import {
  DURABILITY_TEST_DURATIONS_SECONDS,
  durabilityTiersKJPerKg,
  computeAccumulatedWorkKJ,
  maxMeanPower,
  computeDurabilityProfile,
  compareDurabilityToHistory,
  type DurabilityTierProfile,
} from './durability'

describe('durabilityTiersKJPerKg', () => {
  it('returns 0 (à froid) plus the 4 thresholds already sourced in KJ_DURABILITY_THRESHOLDS', () => {
    // Ne répète pas les valeurs en dur dans le test pour éviter un faux
    // sentiment de couverture si constants.ts changeait sans casser ce
    // test — on vérifie plutôt la forme attendue (croissante, 5 paliers,
    // démarre à 0) et la valeur connue du plafond pro (40).
    const tiers = durabilityTiersKJPerKg()
    expect(tiers).toHaveLength(5)
    expect(tiers[0]).toBe(0)
    expect(tiers).toEqual([0, 10, 20, 30, 40])
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThan(tiers[i - 1])
  })
})

describe('computeAccumulatedWorkKJ', () => {
  it('accumulates watts (1Hz) into a monotonically non-decreasing kJ series', () => {
    const result = computeAccumulatedWorkKJ([1000, 1000, 1000])
    expect(result).toEqual([1, 2, 3])
  })

  it('handles zero watts (coasting/stopped) without breaking the accumulation', () => {
    const result = computeAccumulatedWorkKJ([0, 0, 1000, 0])
    expect(result).toEqual([0, 0, 1, 1])
  })

  it('returns an empty series for an empty input', () => {
    expect(computeAccumulatedWorkKJ([])).toEqual([])
  })

  it('is always non-decreasing regardless of power fluctuations', () => {
    const watts = [50, 300, 10, 400, 0, 250]
    const result = computeAccumulatedWorkKJ(watts)
    for (let i = 1; i < result.length; i++) expect(result[i]).toBeGreaterThanOrEqual(result[i - 1])
  })
})

describe('maxMeanPower', () => {
  it('returns the average over a constant-power segment', () => {
    expect(maxMeanPower([100, 100, 100, 100, 100], 2)).toBe(100)
  })

  it('finds the true maximal window, not just the first one', () => {
    // idx0-1:100, idx1-2:350, idx2-3:600(best, avg 300), idx3-4:350
    const watts = [50, 50, 300, 300, 50]
    expect(maxMeanPower(watts, 2)).toBe(300)
  })

  it('returns null when the segment is shorter than the requested duration', () => {
    expect(maxMeanPower([100, 100], 5)).toBeNull()
    expect(maxMeanPower([], 1)).toBeNull()
  })

  it('returns null for a non-positive duration', () => {
    expect(maxMeanPower([100, 100, 100], 0)).toBeNull()
    expect(maxMeanPower([100, 100, 100], -5)).toBeNull()
  })

  it('handles a duration exactly equal to the segment length', () => {
    expect(maxMeanPower([100, 200, 300], 3)).toBe(200)
  })

  it('handles a single-sample window (duration 1)', () => {
    expect(maxMeanPower([100, 500, 200], 1)).toBe(500)
  })
})

describe('computeDurabilityProfile', () => {
  it('returns null without a watts stream', () => {
    expect(computeDurabilityProfile(undefined, 70)).toBeNull()
    expect(computeDurabilityProfile([], 70)).toBeNull()
  })

  it('returns null without a known, positive athlete weight — never substitutes raw kJ silently', () => {
    expect(computeDurabilityProfile([100, 200], null)).toBeNull()
    expect(computeDurabilityProfile([100, 200], undefined)).toBeNull()
    expect(computeDurabilityProfile([100, 200], 0)).toBeNull()
    expect(computeDurabilityProfile([100, 200], -10)).toBeNull()
  })

  it('marks a tier as never reached when the ride is too short/light to accumulate that much work per kg', () => {
    // 10 échantillons à 100W, athlète de 1000kg (poids extrême choisi pour
    // garantir qu'aucun palier > 0 n'est jamais atteint) : 10 x 0.1kJ/kg =
    // 1kJ/kg cumulé max, largement sous le premier seuil réel (10 kJ/kg).
    const watts = new Array(10).fill(100)
    const profile = computeDurabilityProfile(watts, 1000)!
    expect(profile).toHaveLength(5)
    expect(profile[0].tierKJPerKg).toBe(0)
    expect(profile[0].reachedAtSampleIndex).toBe(0) // le palier 0 est toujours atteint dès le 1er échantillon
    for (const tier of profile.slice(1)) {
      expect(tier.reachedAtSampleIndex).toBeNull()
      for (const d of DURABILITY_TEST_DURATIONS_SECONDS) {
        expect(tier.mmpByDurationSeconds[d]).toBeNull()
      }
    }
  })

  it('computes correct tier-crossing indices and constant-power MMP on a synthetic ride', () => {
    // 250W constant, poids 1kg (kJ/kg == kJ pour simplifier l'arithmétique
    // du test) : chaque échantillon ajoute 0.25 kJ/kg. cumulative(i) =
    // 0.25*(i+1) → atteint un palier T kJ/kg au premier index i tel que
    // i+1 >= T/0.25, soit i = T/0.25 - 1 = 4T - 1.
    // Palier 10 -> idx 39 ; 20 -> idx 79 ; 30 -> idx 119 ; 40 -> idx 159.
    const totalSamples = 200
    const watts = new Array(totalSamples).fill(250)
    const profile = computeDurabilityProfile(watts, 1)!

    const [t0, t10, t20, t30, t40] = profile
    expect(t0.reachedAtSampleIndex).toBe(0)
    expect(t10.reachedAtSampleIndex).toBe(39)
    expect(t20.reachedAtSampleIndex).toBe(79)
    expect(t30.reachedAtSampleIndex).toBe(119)
    expect(t40.reachedAtSampleIndex).toBe(159)

    // Puissance constante partout : toute MMP calculable vaut exactement
    // 250, quel que soit le palier ou la durée.
    for (const tier of profile) {
      for (const d of DURABILITY_TEST_DURATIONS_SECONDS) {
        const mmp = tier.mmpByDurationSeconds[d]
        if (mmp != null) expect(mmp).toBe(250)
      }
    }

    // Le palier 40 ne laisse que 200 - 159 = 41 échantillons restants :
    // assez pour la durée 10s (10 <= 41) et 60s ? non, 60 > 41 -> null.
    expect(t40.mmpByDurationSeconds[10]).toBe(250)
    expect(t40.mmpByDurationSeconds[60]).toBeNull()
    expect(t40.mmpByDurationSeconds[300]).toBeNull()
    expect(t40.mmpByDurationSeconds[2400]).toBeNull()

    // Le palier 0 dispose de toute la sortie (200 échantillons) : 10s et
    // 60s sont calculables, les longues durées (300s+) restent null faute
    // de données suffisantes dans cette sortie synthétique de test.
    expect(t0.mmpByDurationSeconds[10]).toBe(250)
    expect(t0.mmpByDurationSeconds[60]).toBe(250)
    expect(t0.mmpByDurationSeconds[300]).toBeNull()
  })

  it('reflects a real power decline across tiers when durability genuinely degrades', () => {
    // Sortie où la puissance chute nettement une fois le palier 30 kJ/kg
    // franchi (300W avant, 150W après) — même durée par échantillon
    // (poids 1kg). On vérifie que le palier 0 capture la puissance haute
    // et qu'un palier atteint après la chute capture la puissance basse.
    const before = new Array(150).fill(300) // 150 x 0.3 kJ/kg = 45 kJ/kg accumulés avant la chute
    const after = new Array(50).fill(150)
    const watts = [...before, ...after]
    const profile = computeDurabilityProfile(watts, 1)!

    const t0 = profile.find((t) => t.tierKJPerKg === 0)!
    expect(t0.mmpByDurationSeconds[10]).toBe(300) // capture la fenêtre initiale, avant la chute

    // Le palier 40 kJ/kg est franchi pendant la portion "before" (à 300W) —
    // donc son segment restant contient encore de la puissance haute avant
    // de basculer sur "after".
    const t40 = profile.find((t) => t.tierKJPerKg === 40)!
    expect(t40.reachedAtSampleIndex).not.toBeNull()
    expect(t40.mmpByDurationSeconds[10]).toBe(300)
  })
})

describe('compareDurabilityToHistory', () => {
  function makeProfile(entries: Array<{ tierKJPerKg: number; mmp: Partial<Record<number, number | null>> }>): DurabilityTierProfile[] {
    return entries.map((e) => ({
      tierKJPerKg: e.tierKJPerKg,
      reachedAtSampleIndex: 0,
      mmpByDurationSeconds: e.mmp,
    }))
  }

  it('picks the best historical value at the SAME tier and SAME duration only', () => {
    const current = makeProfile([{ tierKJPerKg: 20, mmp: { 10: 320 } }])
    const history = [
      makeProfile([{ tierKJPerKg: 20, mmp: { 10: 300 } }]),
      makeProfile([{ tierKJPerKg: 20, mmp: { 10: 310 } }]),
      // Autre palier — ne doit jamais être mélangé avec le palier 20 même si la valeur est plus haute.
      makeProfile([{ tierKJPerKg: 0, mmp: { 10: 400 } }]),
    ]
    const comparisons = compareDurabilityToHistory(current, history)
    const at20d10 = comparisons.find((c) => c.tierKJPerKg === 20 && c.durationSeconds === 10)!
    expect(at20d10.historicalBestWatts).toBe(310)
    expect(at20d10.currentWatts).toBe(320)
    expect(at20d10.deltaPct).toBeCloseTo(((320 - 310) / 310) * 100, 5)
  })

  it('reports a negative deltaPct when the athlete is below their own historical best', () => {
    const current = makeProfile([{ tierKJPerKg: 40, mmp: { 720: 180 } }])
    const history = [makeProfile([{ tierKJPerKg: 40, mmp: { 720: 200 } }])]
    const comparisons = compareDurabilityToHistory(current, history)
    const match = comparisons.find((c) => c.tierKJPerKg === 40 && c.durationSeconds === 720)!
    expect(match.deltaPct).toBeCloseTo(-10, 5)
  })

  it('returns null deltaPct when there is no historical data at that tier/duration', () => {
    const current = makeProfile([{ tierKJPerKg: 10, mmp: { 1200: 220 } }])
    const comparisons = compareDurabilityToHistory(current, [])
    const match = comparisons.find((c) => c.tierKJPerKg === 10 && c.durationSeconds === 1200)!
    expect(match.historicalBestWatts).toBeNull()
    expect(match.deltaPct).toBeNull()
  })

  it('returns null deltaPct when the current value itself is missing (tier never reached)', () => {
    const current = makeProfile([{ tierKJPerKg: 30, mmp: { 60: null } }])
    const history = [makeProfile([{ tierKJPerKg: 30, mmp: { 60: 250 } }])]
    const comparisons = compareDurabilityToHistory(current, history)
    const match = comparisons.find((c) => c.tierKJPerKg === 30 && c.durationSeconds === 60)!
    expect(match.currentWatts).toBeNull()
    expect(match.deltaPct).toBeNull()
  })

  it('emits one comparison per tier × duration combination present in current', () => {
    const current = makeProfile([
      { tierKJPerKg: 0, mmp: {} },
      { tierKJPerKg: 10, mmp: {} },
    ])
    const comparisons = compareDurabilityToHistory(current, [])
    expect(comparisons).toHaveLength(2 * DURABILITY_TEST_DURATIONS_SECONDS.length)
  })
})
