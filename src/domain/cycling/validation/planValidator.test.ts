import { describe, it, expect } from 'vitest'
import {
  checkIntensityDistribution,
  checkKJBudget,
  checkAccumulatedLoadBeforeKeySession,
  checkMonotony,
  checkIntervalVolume,
  checkPlannedSleepBeforeKeySession,
  checkEnergyAvailability,
  checkLoadProgressionWithoutDeload,
  checkTraceability,
  validatePlan,
  type PlanCheckResult,
  type DayLoad,
  type PlannedSleepNight,
  type DailyEnergyBalance,
  type PlanWeekLoad,
} from './planValidator'

describe('checkIntensityDistribution', () => {
  it('is ok within 15 points of the 80% target', () => {
    expect(checkIntensityDistribution(80).verdict).toBe('ok')
    expect(checkIntensityDistribution(70).verdict).toBe('ok') // exactly at the boundary
    expect(checkIntensityDistribution(95).verdict).toBe('ok')
  })

  it('warns beyond 15 points of deviation, either direction', () => {
    expect(checkIntensityDistribution(64).verdict).toBe('warn') // 16 points under
    expect(checkIntensityDistribution(96).verdict).toBe('warn') // 16 points over
  })

  it('is insufficient_data without a zone distribution', () => {
    expect(checkIntensityDistribution(null).verdict).toBe('insufficient_data')
  })
})

describe('checkKJBudget', () => {
  it('is ok under the calibrated ceiling', () => {
    expect(checkKJBudget(50, 60).verdict).toBe('ok')
  })

  it('warns over the ceiling but within 20%', () => {
    expect(checkKJBudget(65, 60).verdict).toBe('warn') // +8.3%
  })

  it('blocks beyond 20% over the ceiling', () => {
    expect(checkKJBudget(73, 60).verdict).toBe('block') // +21.7%
  })

  it('is insufficient_data without both values', () => {
    expect(checkKJBudget(null, 60).verdict).toBe('insufficient_data')
    expect(checkKJBudget(50, null).verdict).toBe('insufficient_data')
    expect(checkKJBudget(50, 0).verdict).toBe('insufficient_data')
  })
})

describe('checkAccumulatedLoadBeforeKeySession', () => {
  it('warns when a key session follows >20 kJ/kg the day before', () => {
    const days: DayLoad[] = [
      { date: '2026-01-01', kJPerKg: 25, isKeySession: false },
      { date: '2026-01-02', kJPerKg: 5, isKeySession: true },
    ]
    expect(checkAccumulatedLoadBeforeKeySession(days).verdict).toBe('warn')
  })

  it('warns when the key session day itself exceeds 20 kJ/kg', () => {
    const days: DayLoad[] = [{ date: '2026-01-01', kJPerKg: 22, isKeySession: true }]
    expect(checkAccumulatedLoadBeforeKeySession(days).verdict).toBe('warn')
  })

  it('is ok when no key session follows heavy accumulated load', () => {
    const days: DayLoad[] = [
      { date: '2026-01-01', kJPerKg: 25, isKeySession: false },
      { date: '2026-01-02', kJPerKg: 5, isKeySession: false },
    ]
    expect(checkAccumulatedLoadBeforeKeySession(days).verdict).toBe('ok')
  })

  it('reuses the sourced 20 kJ/kg threshold — right at 20 is not yet over', () => {
    const days: DayLoad[] = [{ date: '2026-01-01', kJPerKg: 20, isKeySession: true }]
    expect(checkAccumulatedLoadBeforeKeySession(days).verdict).toBe('ok')
  })

  it('is insufficient_data with no days', () => {
    expect(checkAccumulatedLoadBeforeKeySession([]).verdict).toBe('insufficient_data')
  })
})

describe('checkMonotony', () => {
  it('requires an explicit threshold — no invented default', () => {
    // TypeScript already enforces this at compile time (no default param),
    // this test documents the runtime behavior at the boundary instead.
    expect(checkMonotony(2.0, 2.0).verdict).toBe('ok') // at threshold, not over
    expect(checkMonotony(2.01, 2.0).verdict).toBe('warn')
  })

  it('is insufficient_data without a monotony value', () => {
    expect(checkMonotony(null, 2.0).verdict).toBe('insufficient_data')
  })
})

describe('checkIntervalVolume', () => {
  it('always returns insufficient_data — no sourced numeric criterion exists (R19)', () => {
    expect(checkIntervalVolume().verdict).toBe('insufficient_data')
  })
})

describe('checkPlannedSleepBeforeKeySession', () => {
  it('warns when planned sleep is under perceived need before a key session', () => {
    const nights: PlannedSleepNight[] = [{ date: '2026-01-01', plannedSleepHours: 6, perceivedSleepNeedHours: 8, isKeySession: true }]
    expect(checkPlannedSleepBeforeKeySession(nights).verdict).toBe('warn')
  })

  it('is ok when planned sleep meets or exceeds perceived need', () => {
    const nights: PlannedSleepNight[] = [{ date: '2026-01-01', plannedSleepHours: 8, perceivedSleepNeedHours: 8, isKeySession: true }]
    expect(checkPlannedSleepBeforeKeySession(nights).verdict).toBe('ok')
  })

  it('ignores a shortfall on a non-key-session night', () => {
    const nights: PlannedSleepNight[] = [{ date: '2026-01-01', plannedSleepHours: 5, perceivedSleepNeedHours: 8, isKeySession: false }]
    expect(checkPlannedSleepBeforeKeySession(nights).verdict).toBe('ok')
  })

  it('is insufficient_data with no nights', () => {
    expect(checkPlannedSleepBeforeKeySession([]).verdict).toBe('insufficient_data')
  })
})

describe('checkEnergyAvailability', () => {
  it('is ok with no negative-balance days', () => {
    const days: DailyEnergyBalance[] = [{ date: '2026-01-01', balanceKcal: 200 }]
    expect(checkEnergyAvailability(days).verdict).toBe('ok')
  })

  it('warns on a short negative streak', () => {
    const days: DailyEnergyBalance[] = [
      { date: '2026-01-01', balanceKcal: -100 },
      { date: '2026-01-02', balanceKcal: -50 },
    ]
    expect(checkEnergyAvailability(days).verdict).toBe('warn')
  })

  it('blocks once the negative streak exceeds the 14-day (>2 weeks) persistence threshold from the rule text', () => {
    const days: DailyEnergyBalance[] = Array.from({ length: 15 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      balanceKcal: -100,
    }))
    expect(checkEnergyAvailability(days).verdict).toBe('block')
  })

  it('does not block at exactly 14 days — only beyond', () => {
    const days: DailyEnergyBalance[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      balanceKcal: -100,
    }))
    expect(checkEnergyAvailability(days).verdict).toBe('warn')
  })

  it('resets the streak on a positive day — only CONSECUTIVE negative days count', () => {
    const days: DailyEnergyBalance[] = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, balanceKcal: -100 })),
    ]
    days[7] = { date: days[7].date, balanceKcal: 50 } // breaks the streak mid-way
    expect(checkEnergyAvailability(days).verdict).toBe('warn') // longest streak now 7, not 15
  })

  it('is insufficient_data with no data', () => {
    expect(checkEnergyAvailability([]).verdict).toBe('insufficient_data')
  })
})

describe('checkLoadProgressionWithoutDeload', () => {
  it('warns on 4 consecutive weeks of net-increasing load with no recovery week', () => {
    const weeks: PlanWeekLoad[] = [
      { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 2, targetWeeklyMinutes: 330, phase: 'base' },
      { weekNumber: 3, targetWeeklyMinutes: 360, phase: 'build' },
      { weekNumber: 4, targetWeeklyMinutes: 390, phase: 'build' },
    ]
    expect(checkLoadProgressionWithoutDeload(weeks).verdict).toBe('warn')
  })

  it('is ok when a recovery week breaks up the increasing window', () => {
    const weeks: PlanWeekLoad[] = [
      { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 2, targetWeeklyMinutes: 330, phase: 'base' },
      { weekNumber: 3, targetWeeklyMinutes: 180, phase: 'recovery' },
      { weekNumber: 4, targetWeeklyMinutes: 390, phase: 'build' },
    ]
    expect(checkLoadProgressionWithoutDeload(weeks).verdict).toBe('ok')
  })

  it('is ok when the load is flat or decreasing, even without a recovery week', () => {
    const weeks: PlanWeekLoad[] = [
      { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 2, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 3, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 4, targetWeeklyMinutes: 300, phase: 'base' },
    ]
    expect(checkLoadProgressionWithoutDeload(weeks).verdict).toBe('ok')
  })

  it('is insufficient_data with fewer than 4 weeks', () => {
    const weeks: PlanWeekLoad[] = [
      { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 2, targetWeeklyMinutes: 330, phase: 'base' },
    ]
    expect(checkLoadProgressionWithoutDeload(weeks).verdict).toBe('insufficient_data')
  })

  it('finds a violating window even later in a longer plan', () => {
    const weeks: PlanWeekLoad[] = [
      { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' },
      { weekNumber: 2, targetWeeklyMinutes: 180, phase: 'recovery' },
      { weekNumber: 3, targetWeeklyMinutes: 300, phase: 'build' },
      { weekNumber: 4, targetWeeklyMinutes: 330, phase: 'build' },
      { weekNumber: 5, targetWeeklyMinutes: 360, phase: 'build' },
      { weekNumber: 6, targetWeeklyMinutes: 390, phase: 'peak' },
    ]
    // Fenêtre 3-6 : croissante, sans "recovery".
    const result = checkLoadProgressionWithoutDeload(weeks)
    expect(result.verdict).toBe('warn')
    expect(result.detail).toContain('3-6')
  })
})

describe('checkTraceability', () => {
  it('is ok when every result cites a real rule id', () => {
    const results: PlanCheckResult[] = [
      { checkId: 'plan-check-1-intensity-distribution', verdict: 'ok', detail: '' },
      { checkId: 'plan-check-2-kj-budget-weighted', verdict: 'warn', detail: '' },
    ]
    expect(checkTraceability(results).verdict).toBe('ok')
  })

  it('blocks if a result cites an id that does not exist in RULES — self-consistency guard', () => {
    const results: PlanCheckResult[] = [{ checkId: 'plan-check-99-invented', verdict: 'ok', detail: '' }]
    expect(checkTraceability(results).verdict).toBe('block')
  })
})

describe('validatePlan', () => {
  function allOkInput() {
    return {
      weeklyLowIntensityPct: 80,
      plannedWeeklyKJPerKg: 50,
      calibratedCeilingKJPerKg: 60,
      accumulatedLoadDays: [] as DayLoad[],
      monotony: 1.0,
      monotonyThreshold: 2.0,
      plannedSleepNights: [] as PlannedSleepNight[],
      dailyEnergyBalance: [] as DailyEnergyBalance[],
      weeks: [
        { weekNumber: 1, targetWeeklyMinutes: 300, phase: 'base' as const },
        { weekNumber: 2, targetWeeklyMinutes: 300, phase: 'base' as const },
        { weekNumber: 3, targetWeeklyMinutes: 300, phase: 'base' as const },
        { weekNumber: 4, targetWeeklyMinutes: 300, phase: 'base' as const },
      ],
    }
  }

  it('runs all 9 checks (8 core + traceability)', () => {
    const summary = validatePlan(allOkInput())
    expect(summary.results).toHaveLength(9)
  })

  it('is "ok" overall when nothing warns or blocks (interval volume/insufficient_data inputs do not count as warn)', () => {
    const summary = validatePlan(allOkInput())
    expect(summary.overallVerdict).toBe('ok')
  })

  it('is "to-review" once at least 3 checks warn', () => {
    const input = allOkInput()
    input.weeklyLowIntensityPct = 50 // warn (30pt deviation)
    input.plannedWeeklyKJPerKg = 65 // warn (+8.3%)
    input.monotony = 3.0 // warn (over threshold 2.0)
    const summary = validatePlan(input)
    expect(summary.overallVerdict).toBe('to-review')
  })

  it('is "blocked" if any single check blocks, even with fewer than 3 warns', () => {
    const input = allOkInput()
    input.plannedWeeklyKJPerKg = 100 // block (+66%)
    const summary = validatePlan(input)
    expect(summary.overallVerdict).toBe('blocked')
  })
})
