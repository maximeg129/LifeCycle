import { describe, it, expect } from 'vitest'
import {
  fitCriticalPower,
  wPrimeDepletionRateWatts,
  computeWPrimeBalanceDepletionOnly,
  wPrimeReconstitutionRate,
} from './criticalPower'

// Points générés exactement depuis le modèle hyperbolique R14 avec
// CP=250W, W′=20000J (Travail = CP·t + W′) : le fit doit les retrouver.
const CP = 250
const W_PRIME = 20000
function recordAt(seconds: number) {
  const work = CP * seconds + W_PRIME
  return { seconds, watts: work / seconds }
}
const short = recordAt(180) // 3 min
const medium = recordAt(600) // 10 min
const long = recordAt(1200) // 20 min

describe('fitCriticalPower', () => {
  it('recovers CP and W′ from 3 records generated exactly by the model', () => {
    const model = fitCriticalPower([short, medium, long])
    expect(model).not.toBeNull()
    expect(model!.cpWatts).toBeCloseTo(CP, 3)
    expect(model!.wPrimeJoules).toBeCloseTo(W_PRIME, 1)
  })

  it('returns null with fewer than 2 valid records', () => {
    expect(fitCriticalPower([short])).toBeNull()
    expect(fitCriticalPower([])).toBeNull()
  })

  it('ignores zero/negative records', () => {
    const model = fitCriticalPower([short, medium, long, { seconds: 0, watts: 500 }, { seconds: 100, watts: 0 }])
    expect(model!.cpWatts).toBeCloseTo(CP, 3)
  })

  it('returns null when all durations are identical (no slope to fit)', () => {
    expect(fitCriticalPower([{ seconds: 300, watts: 250 }, { seconds: 300, watts: 260 }])).toBeNull()
  })

  it('returns null for a degenerate fit with non-positive CP or W′', () => {
    // Travail total qui DIMINUE avec la durée (100W à 60s = 6000J, puis
    // seulement 5W à 600s = 3000J) — physiologiquement impossible, pente
    // Travail/Durée négative, donc CP <= 0 sur ce fit.
    expect(fitCriticalPower([{ seconds: 60, watts: 100 }, { seconds: 600, watts: 5 }])).toBeNull()
  })
})

describe('wPrimeDepletionRateWatts', () => {
  it('is zero at or below CP — no anaerobic reserve spent', () => {
    expect(wPrimeDepletionRateWatts(250, 300)).toBe(0)
    expect(wPrimeDepletionRateWatts(300, 300)).toBe(0)
  })

  it('is exactly the excess above CP — Q6, W = (P-CP)×t', () => {
    expect(wPrimeDepletionRateWatts(350, 300)).toBe(50)
    expect(wPrimeDepletionRateWatts(500, 300)).toBe(200)
  })

  it('scales faster than the power increase itself (the multiplier effect Q6 describes)', () => {
    // 350W vs 500W au-dessus de CP=300 : x1.43 en puissance, mais x4 en taux de déplétion.
    const rateAt350 = wPrimeDepletionRateWatts(350, 300)
    const rateAt500 = wPrimeDepletionRateWatts(500, 300)
    expect(rateAt500 / rateAt350).toBeCloseTo(4, 5)
  })
})

describe('computeWPrimeBalanceDepletionOnly', () => {
  it('depletes linearly at a constant power above CP', () => {
    // CP=300, W′max=20000J, effort constant à 500W → 200 J/s consommés.
    const watts = new Array(10).fill(500)
    const balance = computeWPrimeBalanceDepletionOnly(watts, 300, 20000)
    expect(balance).toEqual([19800, 19600, 19400, 19200, 19000, 18800, 18600, 18400, 18200, 18000])
  })

  it('never recovers below CP — holds flat rather than fabricating a reconstitution rate', () => {
    const watts = [500, 500, 100, 100, 100] // effort puis repos sous CP (300)
    const balance = computeWPrimeBalanceDepletionOnly(watts, 300, 20000)
    expect(balance[0]).toBe(19800)
    expect(balance[1]).toBe(19600)
    // Sous CP : aucune déplétion supplémentaire, mais pas de remontée non plus.
    expect(balance[2]).toBe(19600)
    expect(balance[3]).toBe(19600)
    expect(balance[4]).toBe(19600)
  })

  it('can reach and go below zero on a sustained effort exceeding W′ — a real exhaustion signal', () => {
    const watts = new Array(200).fill(500) // 200s x 200J/s = 40000J, > W′max de 20000J
    const balance = computeWPrimeBalanceDepletionOnly(watts, 300, 20000)
    expect(balance[balance.length - 1]).toBeLessThan(0)
  })
})

describe('wPrimeReconstitutionRate', () => {
  // Le garde-fou demandé explicitement : jamais de valeur inventée tant
  // que R15 (constante de temps de Skiba 2012) n'a pas été extraite.
  it('always throws today — W_PRIME_RECONSTITUTION_CONSTANT is still pending', () => {
    expect(() => wPrimeReconstitutionRate(300, 100)).toThrowError(/R15/)
  })
})
