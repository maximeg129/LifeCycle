import { describe, it, expect } from 'vitest'
import {
  tsbConfidence,
  readinessConfidence,
  sleepConfidence,
  vitalsConfidence,
  buildReadinessVerdict,
  formeTrendCaption,
  windowAverageTrendCaption,
  sleepTrendCaption,
  vitalsTrendCaption,
} from './readiness-strip-types'

describe('tsbConfidence', () => {
  it('is unknown without a value', () => {
    expect(tsbConfidence(null)).toBe('unknown')
    expect(tsbConfidence(undefined)).toBe('unknown')
  })
  it('is good in fresh/optimal zones', () => {
    expect(tsbConfidence(10)).toBe('good') // fresh
    expect(tsbConfidence(-15)).toBe('good') // optimal
  })
  it('is warn in grey/transition zones', () => {
    expect(tsbConfidence(0)).toBe('warn') // grey
    expect(tsbConfidence(25)).toBe('warn') // transition
  })
  it('is bad in high-risk', () => {
    expect(tsbConfidence(-35)).toBe('bad')
  })
})

describe('readinessConfidence', () => {
  it('is unknown without a value', () => {
    expect(readinessConfidence(null)).toBe('unknown')
  })
  it('matches the existing /lifestyle thresholds', () => {
    expect(readinessConfidence(80)).toBe('good')
    expect(readinessConfidence(60)).toBe('warn')
    expect(readinessConfidence(30)).toBe('bad')
  })
})

describe('sleepConfidence', () => {
  it('is unknown without a value', () => {
    expect(sleepConfidence(undefined)).toBe('unknown')
  })
  it('maps great/good to good, average to warn, poor to bad', () => {
    expect(sleepConfidence(95)).toBe('good')
    expect(sleepConfidence(85)).toBe('good')
    expect(sleepConfidence(70)).toBe('warn')
    expect(sleepConfidence(40)).toBe('bad')
  })
})

describe('vitalsConfidence', () => {
  it('is unknown only when both HRV and resting HR are missing', () => {
    expect(vitalsConfidence(null, null)).toBe('unknown')
  })
  it('is neutral when at least one is present — never a favorable/unfavorable judgment on HRV alone', () => {
    expect(vitalsConfidence(55, null)).toBe('neutral')
    expect(vitalsConfidence(null, 48)).toBe('neutral')
    expect(vitalsConfidence(55, 48)).toBe('neutral')
  })
})

describe('buildReadinessVerdict', () => {
  it('is unknown when both TSB and readiness are missing', () => {
    const v = buildReadinessVerdict(null, null)
    expect(v.confidence).toBe('unknown')
  })
  it('is good when both signals are favorable', () => {
    const v = buildReadinessVerdict(-12, 85)
    expect(v.confidence).toBe('good')
    expect(v.title).toBe('Prêt à performer')
    expect(v.sentence).toContain('TSB en charge productive')
  })
  it('takes the worse of the two signals', () => {
    const v = buildReadinessVerdict(-12, 30) // TSB good, readiness bad
    expect(v.confidence).toBe('bad')
    expect(v.title).toBe('Récupération prioritaire')
  })
  it('degrades gracefully when only one signal is known', () => {
    const v = buildReadinessVerdict(null, 85)
    expect(v.confidence).toBe('good')
    expect(v.sentence).not.toContain('TSB')
  })
})

describe('formeTrendCaption', () => {
  it('is null without any value', () => {
    expect(formeTrendCaption(null, null)).toBeNull()
  })
  it('joins both when present', () => {
    expect(formeTrendCaption(48, 44)).toBe('CTL 48 · ATL 44')
  })
  it('degrades to the one known value', () => {
    expect(formeTrendCaption(48, null)).toBe('CTL 48')
    expect(formeTrendCaption(null, 44)).toBe('ATL 44')
  })
})

describe('windowAverageTrendCaption', () => {
  const history = [
    { date: '2024-01-05', value: 50 },
    { date: '2024-01-06', value: 54 },
    { date: '2024-01-07', value: 58 },
    { date: '2024-01-08', value: 46 }, // today
  ]
  it('is null when today is absent from the series', () => {
    expect(windowAverageTrendCaption(history, '2024-01-09')).toBeNull()
  })
  it('is null when there is no prior day to compare', () => {
    expect(windowAverageTrendCaption([{ date: '2024-01-08', value: 46 }], '2024-01-08')).toBeNull()
  })
  it('computes a signed delta vs the prior-days average, with the real count used', () => {
    // prior avg = (50+54+58)/3 = 54; today 46 -> delta -8
    expect(windowAverageTrendCaption(history, '2024-01-08')).toBe('↓ 8 vs moy. 3 j')
  })
  it('shows "=" for an exact tie', () => {
    const tie = [{ date: '2024-01-07', value: 50 }, { date: '2024-01-08', value: 50 }]
    expect(windowAverageTrendCaption(tie, '2024-01-08')).toBe('= 0 vs moy. 1 j')
  })
})

describe('sleepTrendCaption', () => {
  it('is null without a value', () => {
    expect(sleepTrendCaption(undefined)).toBeNull()
  })
  it('formats the quality percentage', () => {
    expect(sleepTrendCaption(87.4)).toBe('Qualité 87 %')
  })
})

describe('vitalsTrendCaption', () => {
  const today = '2024-02-15'
  function series(baseDate: string, count: number, value: number, stepDays: number): { date: string; value: number }[] {
    const points = []
    const start = new Date(baseDate + 'T00:00:00')
    for (let i = 0; i < count; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() - i * stepDays)
      points.push({ date: d.toISOString().slice(0, 10), value })
    }
    return points
  }
  it('is null without enough baseline history on either signal', () => {
    expect(vitalsTrendCaption([], [], today)).toBeNull()
  })
  it('says "Dans ta norme" when both HRV and resting HR trends are favorable or neutral', () => {
    // Flat series (no real deviation) for both, with full 7+28 day coverage
    const hrv = series(today, 40, 55, 1)
    const rhr = series(today, 40, 50, 1)
    expect(vitalsTrendCaption(hrv, rhr, today)).toBe('Dans ta norme')
  })
})
