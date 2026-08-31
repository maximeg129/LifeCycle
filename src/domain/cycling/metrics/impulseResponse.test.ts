import { describe, it, expect } from 'vitest'
import { stepFitnessFatigue, computeFitnessFatigueSeries, projectFitnessFatigue } from './impulseResponse'

describe('stepFitnessFatigue', () => {
  it('applies the EWMA update with the 42j/7j windows (IMPULSE_RESPONSE_WINDOWS)', () => {
    const result = stepFitnessFatigue({ ctl: 0, atl: 0 }, 100)
    expect(result.ctl).toBeCloseTo(100 / 42, 10)
    expect(result.atl).toBeCloseTo(100 / 7, 10)
  })

  it('leaves both values unchanged at steady state (load == current value)', () => {
    const result = stepFitnessFatigue({ ctl: 50, atl: 50 }, 50)
    expect(result.ctl).toBeCloseTo(50, 10)
    expect(result.atl).toBeCloseTo(50, 10)
  })

  it('decays both values on a zero-load (rest) day, ATL faster than CTL (shorter window)', () => {
    const result = stepFitnessFatigue({ ctl: 50, atl: 50 }, 0)
    expect(result.ctl).toBeCloseTo((50 * 41) / 42, 10) // 50 - 50/42
    expect(result.atl).toBeCloseTo((50 * 6) / 7, 10) // 50 - 50/7
    // La fatigue (fenêtre courte) doit décroître plus vite que la forme (fenêtre longue).
    expect(50 - result.atl).toBeGreaterThan(50 - result.ctl)
  })

  it('reacts to a load spike with ATL rising faster than CTL — fatigue outruns fitness short-term', () => {
    const result = stepFitnessFatigue({ ctl: 20, atl: 20 }, 200)
    expect(result.atl).toBeGreaterThan(result.ctl)
  })
})

describe('computeFitnessFatigueSeries', () => {
  it('returns an empty series for no daily loads', () => {
    expect(computeFitnessFatigueSeries([])).toEqual([])
  })

  it('produces one point per day, matching stepFitnessFatigue applied in sequence', () => {
    const series = computeFitnessFatigueSeries([100, 100, 0])
    expect(series).toHaveLength(3)

    const day1 = stepFitnessFatigue({ ctl: 0, atl: 0 }, 100)
    expect(series[0].ctl).toBeCloseTo(day1.ctl, 10)
    expect(series[0].atl).toBeCloseTo(day1.atl, 10)

    const day2 = stepFitnessFatigue(day1, 100)
    expect(series[1].ctl).toBeCloseTo(day2.ctl, 10)

    const day3 = stepFitnessFatigue(day2, 0)
    expect(series[2].ctl).toBeCloseTo(day3.ctl, 10)
  })

  it('always reports tsb as ctl - atl, every point', () => {
    const series = computeFitnessFatigueSeries([50, 80, 0, 120, 0, 0])
    for (const point of series) {
      expect(point.tsb).toBeCloseTo(point.ctl - point.atl, 10)
    }
  })

  it('starts from the given initial state rather than always from zero', () => {
    const fromZero = computeFitnessFatigueSeries([100], { ctl: 0, atl: 0 })
    const fromKnown = computeFitnessFatigueSeries([100], { ctl: 60, atl: 40 })
    expect(fromKnown[0].ctl).not.toBeCloseTo(fromZero[0].ctl, 5)
    expect(fromKnown[0].ctl).toBeCloseTo(60 + (100 - 60) / 42, 10)
    expect(fromKnown[0].atl).toBeCloseTo(40 + (100 - 40) / 7, 10)
  })

  it('converges toward a sustained constant load over a long window, ATL converging faster than CTL', () => {
    const load = 100
    const longSeries = computeFitnessFatigueSeries(new Array(400).fill(load))
    const last = longSeries[longSeries.length - 1]
    expect(last.ctl).toBeCloseTo(load, 1)
    expect(last.atl).toBeCloseTo(load, 1)

    // À mi-parcours, ATL doit déjà être beaucoup plus proche de la cible que CTL
    // (fenêtre 7j vs 42j) — une vraie propriété du modèle, pas un artefact.
    const midSeries = computeFitnessFatigueSeries(new Array(20).fill(load))
    const mid = midSeries[midSeries.length - 1]
    expect(load - mid.atl).toBeLessThan(load - mid.ctl)
  })

  it('lets TSB (form) rise during a rest block after sustained load — the freshness the model exists to capture', () => {
    const buildUp = computeFitnessFatigueSeries(new Array(60).fill(100))
    const lastBuildUp = buildUp[buildUp.length - 1]
    expect(lastBuildUp.tsb).toBeLessThan(0) // en pleine charge, la fatigue dépasse la forme

    const rest = computeFitnessFatigueSeries(new Array(14).fill(0), lastBuildUp)
    expect(rest[rest.length - 1].tsb).toBeGreaterThan(lastBuildUp.tsb)
  })
})

describe('projectFitnessFatigue', () => {
  it('is equivalent to computeFitnessFatigueSeries seeded with the given current state', () => {
    const current = { ctl: 55, atl: 45 }
    const futureDailyLoads = [80, 90, 0, 0, 60]
    const projected = projectFitnessFatigue(current, futureDailyLoads)
    const expected = computeFitnessFatigueSeries(futureDailyLoads, current)
    expect(projected).toEqual(expected)
  })

  it('never mutates or ignores the supplied current state — the first point builds on it, not on zero', () => {
    const projected = projectFitnessFatigue({ ctl: 70, atl: 70 }, [70])
    // état déjà stable (charge == valeurs courantes) : le premier point projeté doit rester ~70, pas retomber vers 0.
    expect(projected[0].ctl).toBeCloseTo(70, 5)
    expect(projected[0].atl).toBeCloseTo(70, 5)
  })

  it('returns an empty projection for an empty future', () => {
    expect(projectFitnessFatigue({ ctl: 10, atl: 10 }, [])).toEqual([])
  })
})
