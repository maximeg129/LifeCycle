import { describe, it, expect } from 'vitest'
import {
  getDayId,
  getLastDayIds,
  dayIdToSeconds,
  average,
  trendPct,
  buildDailySeries,
  computeReadiness,
  readinessBaselineLookbackDays,
  computeGoalProgress,
  mergeDailyWellness,
  buildMergedDailySeries,
  pickLatestWithData,
  sleepQualityBand,
  previousValue,
  vitalTrend,
  formatSleepDuration,
  type HealthMetricLike,
} from './lifestyle-types'

function ts(seconds: number) {
  return { seconds }
}

function dateSeconds(y: number, m: number, d: number) {
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000)
}

describe('getDayId', () => {
  it('formats yyyy-MM-dd with zero-padding', () => {
    expect(getDayId(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getLastDayIds', () => {
  it('returns count days ending at `from`, oldest first', () => {
    const ids = getLastDayIds(3, new Date(2026, 2, 10))
    expect(ids).toEqual(['2026-03-08', '2026-03-09', '2026-03-10'])
  })

  it('handles month rollover', () => {
    const ids = getLastDayIds(3, new Date(2026, 2, 1))
    expect(ids).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('average', () => {
  it('averages a list of numbers', () => {
    expect(average([1, 2, 3])).toBe(2)
  })
  it('returns 0 for an empty list', () => {
    expect(average([])).toBe(0)
  })
})

describe('trendPct', () => {
  it('computes percent change', () => {
    expect(trendPct(50, 60)).toBe(20)
    expect(trendPct(60, 50)).toBe(-17)
  })
  it('returns 0 when the starting value is 0', () => {
    expect(trendPct(0, 60)).toBe(0)
  })
})

describe('buildDailySeries', () => {
  it('maps entries onto the requested day ids, leaving gaps empty', () => {
    const metrics: HealthMetricLike[] = [
      { date: ts(dateSeconds(2026, 3, 1)), sleepHours: 7 },
      { date: ts(dateSeconds(2026, 3, 3)), sleepHours: 8 },
    ]
    const series = buildDailySeries(metrics, ['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(series.map((s) => s.dayId)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(series[0].sleepHours).toBe(7)
    expect(series[1].sleepHours).toBeUndefined()
    expect(series[2].sleepHours).toBe(8)
  })
})

describe('computeReadiness', () => {
  it('returns null when there is no entry', () => {
    expect(computeReadiness(undefined)).toBeNull()
  })

  it('returns null when the entry has none of the relevant fields', () => {
    expect(computeReadiness({ date: null })).toBeNull()
  })

  it('averages sleepQuality, inverted stress, and mood*10', () => {
    // sleepQuality 80, stress 20 (-> 80), mood 8 (-> 80): average 80
    expect(computeReadiness({ date: null, sleepQuality: 80, stressScore: 20, mood: 8 })).toBe(80)
  })

  it('works with a partial entry', () => {
    expect(computeReadiness({ date: null, sleepQuality: 60 })).toBe(60)
  })
})

/**
 * Builds 36 consecutive days of history for `field`, referenceDay's most
 * recent 8 days (the "recent" window windowedTrendSignal compares) set to
 * `recentValue`, the preceding 28 days ("baseline") set to `baselineValue` —
 * enough points in both windows for a real (non-null) trend signal.
 */
function buildTrendHistory(
  field: 'hrv' | 'restingHR',
  baselineValue: number,
  recentValue: number,
  referenceDay = '2026-03-31'
): (HealthMetricLike & { dayId: string })[] {
  const ref = new Date(referenceDay + 'T00:00:00')
  const days: (HealthMetricLike & { dayId: string })[] = []
  for (let i = 35; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(d.getDate() - i)
    days.push({ date: null, dayId: getDayId(d), [field]: i <= 7 ? recentValue : baselineValue })
  }
  return days
}

describe('computeReadiness — HRV/FC repos (history)', () => {
  const referenceDay = '2026-03-31'

  it('adds a favorable HRV trend (recent > baseline) as a 100 component', () => {
    const history = buildTrendHistory('hrv', 40, 60, referenceDay)
    expect(computeReadiness({ date: null, dayId: referenceDay }, history)).toBe(100)
  })

  it('adds an unfavorable HRV trend (recent < baseline) as a 0 component', () => {
    const history = buildTrendHistory('hrv', 60, 40, referenceDay)
    expect(computeReadiness({ date: null, dayId: referenceDay }, history)).toBe(0)
  })

  it('adds a favorable resting-HR trend (recent LOWER than baseline) as a 100 component', () => {
    const history = buildTrendHistory('restingHR', 65, 55, referenceDay)
    expect(computeReadiness({ date: null, dayId: referenceDay }, history)).toBe(100)
  })

  it('adds an unfavorable resting-HR trend (recent HIGHER than baseline) as a 0 component', () => {
    const history = buildTrendHistory('restingHR', 55, 65, referenceDay)
    expect(computeReadiness({ date: null, dayId: referenceDay }, history)).toBe(0)
  })

  it('blends a favorable HRV trend with sleepQuality (average of the two)', () => {
    const history = buildTrendHistory('hrv', 40, 60, referenceDay)
    expect(computeReadiness({ date: null, dayId: referenceDay, sleepQuality: 80 }, history)).toBe(90)
  })

  it('computes readiness purely from HRV+resting-HR trends when sleep/stress/mood are all absent', () => {
    const hrvHistory = buildTrendHistory('hrv', 40, 60, referenceDay)
    const rhrHistory = buildTrendHistory('restingHR', 65, 55, referenceDay)
    const history = hrvHistory.map((d, i) => ({ ...d, restingHR: rhrHistory[i].restingHR }))
    expect(computeReadiness({ date: null, dayId: referenceDay }, history)).toBe(100)
  })

  it('omits HRV/RHR (falls back to sleep/stress/mood only) when history is not supplied', () => {
    expect(computeReadiness({ date: null, dayId: referenceDay, sleepQuality: 80 })).toBe(80)
  })

  it('omits HRV/RHR when latest has no dayId, even if history is supplied', () => {
    const history = buildTrendHistory('hrv', 40, 60, referenceDay)
    expect(computeReadiness({ date: null, sleepQuality: 80 }, history)).toBe(80)
  })

  it('omits HRV/RHR when there is not enough baseline history yet', () => {
    // Only 5 days of history — windowedTrendSignal needs >=2 points in a
    // preceding baseline window it simply doesn't have here.
    const short: (HealthMetricLike & { dayId: string })[] = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'].map((dayId) => ({
      date: null,
      dayId,
      hrv: 60,
    }))
    expect(computeReadiness({ date: null, dayId: referenceDay, sleepQuality: 80 }, short)).toBe(80)
  })

  it('returns null when only HRV/RHR were candidates and neither has a usable trend', () => {
    const short: (HealthMetricLike & { dayId: string })[] = [{ date: null, dayId: referenceDay, hrv: 60 }]
    expect(computeReadiness({ date: null, dayId: referenceDay }, short)).toBeNull()
  })
})

describe('readinessBaselineLookbackDays', () => {
  it('matches GOVERNOR_BASELINE_WINDOW (28 days, ≥4 semaines per principle-2)', () => {
    expect(readinessBaselineLookbackDays()).toBe(28)
  })
})

describe('computeGoalProgress', () => {
  it('caps at 100% for a "min" goal once the average meets the target', () => {
    const recent: HealthMetricLike[] = [{ date: null, sleepHours: 8 }, { date: null, sleepHours: 9 }]
    const progress = computeGoalProgress({ metric: 'sleepHours', target: 7, direction: 'min' }, recent)
    expect(progress.met).toBe(true)
    expect(progress.pct).toBe(100)
    expect(progress.currentAvg).toBeCloseTo(8.5)
  })

  it('scales proportionally below target for a "min" goal', () => {
    const recent: HealthMetricLike[] = [{ date: null, sleepHours: 3.5 }]
    const progress = computeGoalProgress({ metric: 'sleepHours', target: 7, direction: 'min' }, recent)
    expect(progress.met).toBe(false)
    expect(progress.pct).toBe(50)
  })

  it('treats being under target as 100% for a "max" goal', () => {
    const recent: HealthMetricLike[] = [{ date: null, stressScore: 20 }]
    const progress = computeGoalProgress({ metric: 'stressScore', target: 30, direction: 'max' }, recent)
    expect(progress.met).toBe(true)
    expect(progress.pct).toBe(100)
  })

  it('degrades the score when average exceeds a "max" target', () => {
    const recent: HealthMetricLike[] = [{ date: null, stressScore: 60 }]
    const progress = computeGoalProgress({ metric: 'stressScore', target: 30, direction: 'max' }, recent)
    expect(progress.met).toBe(false)
    expect(progress.pct).toBe(50)
  })

  it('returns 0/false when there is no data for the tracked metric', () => {
    const progress = computeGoalProgress({ metric: 'hrv', target: 60, direction: 'min' }, [{ date: null, sleepHours: 7 }])
    expect(progress.pct).toBe(0)
    expect(progress.met).toBe(false)
  })
})

describe('sleepQualityBand', () => {
  it('matches Intervals.icu\'s own boundaries (90/80/60)', () => {
    expect(sleepQualityBand(95)).toBe('great')
    expect(sleepQualityBand(90)).toBe('great')
    expect(sleepQualityBand(89)).toBe('good')
    expect(sleepQualityBand(82)).toBe('good') // the screenshot's own score, "Q2"/Good
    expect(sleepQualityBand(80)).toBe('good')
    expect(sleepQualityBand(79)).toBe('average')
    expect(sleepQualityBand(60)).toBe('average')
    expect(sleepQualityBand(59)).toBe('poor')
    expect(sleepQualityBand(0)).toBe('poor')
  })
})

describe('mergeDailyWellness', () => {
  it('fills every field from wellness when nothing was manually logged, using sleepScore (0-100) for sleepQuality', () => {
    const merged = mergeDailyWellness(undefined, { sleepSecs: 27000, sleepScore: 88, hrv: 62, mood: 7 })
    expect(merged).toEqual({ date: null, sleepHours: 7.5, sleepQuality: 88, hrv: 62, stressScore: undefined, mood: 7 })
  })

  // Regression: caught live via user feedback (a screenshot of their own
  // Intervals.icu day view showing "82 Q2" side by side) — Intervals.icu's
  // own `sleepQuality` field is a derived 1-4 band (Great/Good/Average/
  // Poor), NOT a percentage. Preferring it over sleepScore used to turn a
  // "Good" night (2) into "Qualité 2%".
  it('prefers sleepScore (real 0-100) over the raw 1-4 sleepQuality band when both are present', () => {
    const merged = mergeDailyWellness(undefined, { sleepSecs: 27060, sleepScore: 82, sleepQuality: 2 })
    expect(merged?.sleepQuality).toBe(82)
  })

  it('falls back to a band-derived estimate when only the raw 1-4 category is present (no score)', () => {
    const merged = mergeDailyWellness(undefined, { sleepSecs: 3600, sleepQuality: 2 })
    expect(merged?.sleepQuality).toBe(85) // midpoint of Good (80-89)
  })

  it('has no sleepQuality when wellness carries neither sleepScore nor sleepQuality', () => {
    const merged = mergeDailyWellness(undefined, { sleepSecs: 3600 })
    expect(merged?.sleepQuality).toBeUndefined()
  })

  it('carries restingHR through from wellness, manual winning when both are present', () => {
    expect(mergeDailyWellness(undefined, { restingHR: 48 })?.restingHR).toBe(48)
    expect(mergeDailyWellness({ date: null, restingHR: 45 }, { restingHR: 48 })?.restingHR).toBe(45)
  })

  it('lets a manual entry win field-by-field over the auto-synced reading', () => {
    const manual: HealthMetricLike = { date: ts(100), sleepHours: 6, stressScore: 40 }
    const merged = mergeDailyWellness(manual, { sleepSecs: 27000, hrv: 62, mood: 7 })
    expect(merged).toEqual({ date: ts(100), sleepHours: 6, sleepQuality: undefined, hrv: 62, stressScore: 40, mood: 7 })
  })

  it('returns the manual entry untouched when there is no wellness reading for that day', () => {
    const manual: HealthMetricLike = { date: ts(100), sleepHours: 6 }
    expect(mergeDailyWellness(manual, undefined)).toBe(manual)
  })

  it('is undefined when neither source has data for the day', () => {
    expect(mergeDailyWellness(undefined, undefined)).toBeUndefined()
  })
})

describe('buildMergedDailySeries', () => {
  it('matches wellness rows to manual entries by dayId, manual winning on overlap', () => {
    const manual: HealthMetricLike[] = [{ date: ts(dateSeconds(2026, 3, 9)), sleepHours: 6 }]
    const wellnessByDay = new Map([
      ['2026-03-08', { hrv: 55 }],
      ['2026-03-09', { sleepSecs: 30600, hrv: 60 }], // manual sleepHours should win here
    ])
    const series = buildMergedDailySeries(manual, wellnessByDay, ['2026-03-08', '2026-03-09'])
    expect(series[0]).toMatchObject({ dayId: '2026-03-08', hrv: 55 })
    expect(series[1]).toMatchObject({ dayId: '2026-03-09', sleepHours: 6, hrv: 60 })
    // Regression: a wellness-only day (no manual entry) must still carry a
    // real date, or the "last measured" badge wrongly reads "no data".
    expect(series[0].date?.seconds).toBe(dayIdToSeconds('2026-03-08'))
  })

  it('still dates an empty day from its dayId, even with no data from either source', () => {
    const series = buildMergedDailySeries([], new Map(), ['2026-03-08'])
    expect(series).toEqual([{ date: { seconds: dayIdToSeconds('2026-03-08') }, dayId: '2026-03-08' }])
  })
})

describe('pickLatestWithData', () => {
  it('picks the most recent day (series is oldest-first) that has any field set', () => {
    const series = [
      { date: null, dayId: '2026-03-08' },
      { date: null, dayId: '2026-03-09', hrv: 60 },
      { date: null, dayId: '2026-03-10' }, // today, nothing logged yet
    ]
    expect(pickLatestWithData(series)?.dayId).toBe('2026-03-09')
  })

  it('is undefined when no day in the series has any data', () => {
    expect(pickLatestWithData([{ date: null, dayId: '2026-03-08' }])).toBeUndefined()
  })
})

describe('previousValue', () => {
  const series = [
    { date: null, dayId: '2026-03-07', restingHR: 50 },
    { date: null, dayId: '2026-03-08' }, // gap day, no restingHR
    { date: null, dayId: '2026-03-09', restingHR: 48 },
    { date: null, dayId: '2026-03-10', restingHR: 52 },
  ]

  it('finds the value on the day right before the reference day', () => {
    expect(previousValue(series, '2026-03-10', 'restingHR')).toBe(48)
  })

  it('walks back past a gap day missing that field', () => {
    expect(previousValue(series, '2026-03-09', 'restingHR')).toBe(50)
  })

  it('is undefined for the first day in the series (nothing before it)', () => {
    expect(previousValue(series, '2026-03-07', 'restingHR')).toBeUndefined()
  })

  it('is undefined when the reference day is not in the series', () => {
    expect(previousValue(series, '2099-01-01', 'restingHR')).toBeUndefined()
  })
})

describe('vitalTrend', () => {
  it('is null when either value is missing', () => {
    expect(vitalTrend(undefined, 50, 'lower-better')).toBeNull()
    expect(vitalTrend(50, undefined, 'lower-better')).toBeNull()
  })

  it('is neutral on an exact tie', () => {
    expect(vitalTrend(50, 50, 'lower-better')).toBe('neutral')
    expect(vitalTrend(60, 60, 'higher-better')).toBe('neutral')
  })

  it('is good when a lower-better metric decreased, bad when it increased (e.g. resting HR)', () => {
    expect(vitalTrend(48, 52, 'lower-better')).toBe('good')
    expect(vitalTrend(55, 52, 'lower-better')).toBe('bad')
  })

  it('is good when a higher-better metric increased, bad when it decreased (e.g. HRV)', () => {
    expect(vitalTrend(70, 65, 'higher-better')).toBe('good')
    expect(vitalTrend(60, 65, 'higher-better')).toBe('bad')
  })
})

describe('formatSleepDuration', () => {
  it('formats decimal hours as XhYY', () => {
    expect(formatSleepDuration(7.5)).toBe('7h30')
    expect(formatSleepDuration(7)).toBe('7h00')
    expect(formatSleepDuration(6.25)).toBe('6h15')
  })

  it('rounds to the nearest minute', () => {
    expect(formatSleepDuration(7.516)).toBe('7h31') // matches the screenshot's own "7h31m"
  })

  it('carries a minute rollover into the hour', () => {
    expect(formatSleepDuration(6.9933)).toBe('7h00') // 419.6min rounds to 420min = 7h00, not 6h60
  })
})
