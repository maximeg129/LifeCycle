import { describe, it, expect } from 'vitest'
import {
  clampWeeklyMinutes,
  weeksUntilEvent,
  clampPlanWeeks,
  buildPlanWeekSkeleton,
  mergePlanWeeks,
  currentPlanWeek,
  findWeekStrengthSession,
  planSessionExternalId,
  weekNeedsRecalibration,
  computeActualWeeklyMinutes,
  diffPlanWeeks,
  applyRecalibration,
  distributeWeekdayOffsets,
  assignSessionDates,
  clampDateToWeek,
  nextAvailableWeekDate,
  matchSessionCompletion,
  planAutoRescheduleMoves,
  assignSessionDatesByAvailability,
  computePlanProgress,
  computeWeeklyAdherence,
  rollingWindowDates,
  weekdayAvailabilityForDate,
  recalibrateRollingWindow,
  sessionsForRollingWindow,
  type PlanWeekContent,
  type PlanWeek,
  type PlanWeekAdjustment,
  type PlanWeekSessionWithValidation,
  type PlanWeekSkeleton,
  type SessionCompletion,
  type SessionCompletionStatus,
  type WeekdayAvailabilityMinutes,
  type RollingWeekInput,
} from './training-plan-types'

describe('clampWeeklyMinutes', () => {
  it('passes through a value already in range', () => {
    expect(clampWeeklyMinutes(600)).toBe(600)
  })

  it('floors to the minimum for a too-small value', () => {
    expect(clampWeeklyMinutes(10)).toBe(60)
  })

  it('caps at the maximum for a very large value', () => {
    expect(clampWeeklyMinutes(5000)).toBe(1500)
  })

  it('falls back to the minimum for NaN', () => {
    expect(clampWeeklyMinutes(NaN)).toBe(60)
  })
})

describe('weeksUntilEvent', () => {
  it('computes whole weeks for an exact multiple of 7 days', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-10-23')).toBe(8)
  })

  it('floors a partial week', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-10-27')).toBe(8)
  })

  it('returns 0 for an event this week', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-08-30')).toBe(0)
  })

  it('returns a negative number for a past event', () => {
    expect(weeksUntilEvent('2026-08-28', '2026-08-01')).toBeLessThan(0)
  })
})

describe('clampPlanWeeks', () => {
  it('passes through a value already in range', () => {
    expect(clampPlanWeeks(12)).toBe(12)
  })

  it('floors to the minimum for a too-small or negative value', () => {
    expect(clampPlanWeeks(1)).toBe(2)
    expect(clampPlanWeeks(-3)).toBe(2)
  })

  it('caps at the maximum for a very large value', () => {
    expect(clampPlanWeeks(52)).toBe(24)
  })
})

describe('buildPlanWeekSkeleton', () => {
  it('aligns the first week to the Monday containing the start date', () => {
    // 2026-08-28 is a Friday
    const weeks = buildPlanWeekSkeleton('2026-08-28', 3)
    expect(weeks[0]).toEqual({ weekNumber: 1, startDate: '2026-08-24', endDate: '2026-08-30' })
  })

  it('produces contiguous, non-overlapping 7-day weeks', () => {
    const weeks = buildPlanWeekSkeleton('2026-08-28', 3)
    expect(weeks).toEqual([
      { weekNumber: 1, startDate: '2026-08-24', endDate: '2026-08-30' },
      { weekNumber: 2, startDate: '2026-08-31', endDate: '2026-09-06' },
      { weekNumber: 3, startDate: '2026-09-07', endDate: '2026-09-13' },
    ])
  })

  it('returns an empty array for zero weeks', () => {
    expect(buildPlanWeekSkeleton('2026-08-28', 0)).toEqual([])
  })
})

describe('mergePlanWeeks', () => {
  const skeleton = buildPlanWeekSkeleton('2026-08-28', 2)
  const content: PlanWeekContent[] = [
    { phase: 'base', focus: 'Endurance', targetWeeklyMinutes: 300 },
    { phase: 'build', focus: 'Seuil', targetWeeklyMinutes: 360, notes: 'Semaine de charge' },
  ]

  it('zips content onto the skeleton by index', () => {
    const weeks = mergePlanWeeks(skeleton, content)
    expect(weeks[0]).toMatchObject({ weekNumber: 1, phase: 'base', focus: 'Endurance', targetWeeklyMinutes: 300 })
    expect(weeks[1]).toMatchObject({ weekNumber: 2, phase: 'build', notes: 'Semaine de charge' })
  })

  it('falls back to safe defaults for a missing week rather than crashing', () => {
    const weeks = mergePlanWeeks(skeleton, [content[0]])
    expect(weeks[1]).toMatchObject({ weekNumber: 2, phase: 'base', focus: '', targetWeeklyMinutes: 0 })
  })

  it('ignores extra content beyond the skeleton length', () => {
    const weeks = mergePlanWeeks(skeleton, [...content, { phase: 'peak', focus: 'extra', targetWeeklyMinutes: 999 }])
    expect(weeks).toHaveLength(2)
  })

  it('omits the notes key entirely rather than setting it to undefined — Firestore setDoc/updateDoc throws on an explicit undefined field value anywhere in the payload, including nested in an array element', () => {
    const weeks = mergePlanWeeks(skeleton, [content[0]]) // week without notes
    expect('notes' in weeks[0]).toBe(false)
    expect(JSON.stringify(weeks[0])).not.toContain('notes')
  })

  it('carries targetStrengthMinutes through when the AI content includes it (musculation requested)', () => {
    const withStrength: PlanWeekContent[] = [{ phase: 'base', focus: 'Endurance', targetWeeklyMinutes: 300, targetStrengthMinutes: 60 }]
    const weeks = mergePlanWeeks(skeleton, withStrength)
    expect(weeks[0].targetStrengthMinutes).toBe(60)
  })

  it('omits targetStrengthMinutes entirely (not 0/undefined) when musculation was not requested — same Firestore-undefined trap as notes', () => {
    const weeks = mergePlanWeeks(skeleton, [content[0]]) // no targetStrengthMinutes
    expect('targetStrengthMinutes' in weeks[0]).toBe(false)
    expect(JSON.stringify(weeks[0])).not.toContain('targetStrengthMinutes')
  })
})

describe('currentPlanWeek', () => {
  const weeks = mergePlanWeeks(buildPlanWeekSkeleton('2026-08-28', 3), [
    { phase: 'base', focus: 'A', targetWeeklyMinutes: 300 },
    { phase: 'build', focus: 'B', targetWeeklyMinutes: 360 },
    { phase: 'taper', focus: 'C', targetWeeklyMinutes: 180 },
  ])

  it('finds the week containing a given date', () => {
    expect(currentPlanWeek(weeks, '2026-09-01')?.weekNumber).toBe(2)
  })

  it('matches on the exact boundary dates', () => {
    expect(currentPlanWeek(weeks, '2026-08-24')?.weekNumber).toBe(1)
    expect(currentPlanWeek(weeks, '2026-09-13')?.weekNumber).toBe(3)
  })

  it('returns null before the plan starts', () => {
    expect(currentPlanWeek(weeks, '2026-08-01')).toBeNull()
  })

  it('returns null after the plan ends', () => {
    expect(currentPlanWeek(weeks, '2026-12-01')).toBeNull()
  })

  it('returns null for an empty plan', () => {
    expect(currentPlanWeek([], '2026-09-01')).toBeNull()
  })
})

describe('planSessionExternalId', () => {
  it('is deterministic for the same plan/week/session', () => {
    expect(planSessionExternalId('plan1', 3, 0)).toBe(planSessionExternalId('plan1', 3, 0))
  })

  it('differs across plans, weeks and session indices', () => {
    const base = planSessionExternalId('plan1', 3, 0)
    expect(planSessionExternalId('plan2', 3, 0)).not.toBe(base)
    expect(planSessionExternalId('plan1', 4, 0)).not.toBe(base)
    expect(planSessionExternalId('plan1', 3, 1)).not.toBe(base)
  })
})

// 4 semaines, lundi 2026-08-24 : S1 [24-30 août], S2 [31 août-6 sept],
// S3 [7-13 sept], S4 [14-20 sept].
const fourWeeks: PlanWeek[] = mergePlanWeeks(buildPlanWeekSkeleton('2026-08-24', 4), [
  { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
  { phase: 'base', focus: 'S2', targetWeeklyMinutes: 330 },
  { phase: 'build', focus: 'S3', targetWeeklyMinutes: 360 },
  { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 180 },
])

describe('weekNeedsRecalibration', () => {
  it('flags the most recently completed week when nothing has been recalibrated yet', () => {
    // Week 1 ended 08-30, today 09-01 → week 1 completed, weeks 2-4 still ahead.
    expect(weekNeedsRecalibration(fourWeeks, undefined, '2026-09-01')).toBe(1)
  })

  it('returns null once already recalibrated through the only completed week', () => {
    expect(weekNeedsRecalibration(fourWeeks, 1, '2026-09-01')).toBeNull()
  })

  it('picks up the latest completed week when several have finished since the last recalibration', () => {
    // Weeks 1 and 2 both ended before 09-08.
    expect(weekNeedsRecalibration(fourWeeks, undefined, '2026-09-08')).toBe(2)
  })

  it('returns null when no week has completed yet', () => {
    expect(weekNeedsRecalibration(fourWeeks, undefined, '2026-08-25')).toBeNull()
  })

  it('returns null when every week is already completed — nothing left to adjust', () => {
    expect(weekNeedsRecalibration(fourWeeks, undefined, '2026-12-01')).toBeNull()
  })

  it('returns null for an empty plan', () => {
    expect(weekNeedsRecalibration([], undefined, '2026-09-01')).toBeNull()
  })
})

describe('computeActualWeeklyMinutes', () => {
  const week = fourWeeks[0] // 2026-08-24 to 2026-08-30

  it('sums only activities within the week window', () => {
    const activities = [
      { startDate: '2026-08-25', durationMinutes: 60 },
      { startDate: '2026-08-30', durationMinutes: 90 }, // last day, inclusive
      { startDate: '2026-08-31', durationMinutes: 120 }, // next week, excluded
      { startDate: '2026-08-23', durationMinutes: 45 }, // previous week, excluded
    ]
    expect(computeActualWeeklyMinutes(activities, week)).toBe(150)
  })

  it('returns 0 for no matching activities', () => {
    expect(computeActualWeeklyMinutes([{ startDate: '2026-01-01', durationMinutes: 60 }], week)).toBe(0)
  })

  it('returns 0 for an empty activity list', () => {
    expect(computeActualWeeklyMinutes([], week)).toBe(0)
  })
})

describe('diffPlanWeeks', () => {
  it('reports only the weeks whose content actually changed', () => {
    const adjustments: PlanWeekAdjustment[] = [
      { weekNumber: 2, phase: 'base', focus: 'S2', targetWeeklyMinutes: 330 }, // unchanged
      { weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 }, // changed
    ]
    const changes = diffPlanWeeks(fourWeeks, adjustments)
    expect(changes).toHaveLength(1)
    expect(changes[0].weekNumber).toBe(3)
    expect(changes[0].before).toEqual({ phase: 'build', focus: 'S3', targetWeeklyMinutes: 360 })
    expect(changes[0].after).toEqual({ phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 })
  })

  it('ignores an adjustment for a week that does not exist in `before`', () => {
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 99, phase: 'base', focus: 'x', targetWeeklyMinutes: 100 }]
    expect(diffPlanWeeks(fourWeeks, adjustments)).toEqual([])
  })

  it('returns an empty array when nothing changed', () => {
    const adjustments: PlanWeekAdjustment[] = fourWeeks.map((w) => ({
      weekNumber: w.weekNumber,
      phase: w.phase,
      focus: w.focus,
      targetWeeklyMinutes: w.targetWeeklyMinutes,
    }))
    expect(diffPlanWeeks(fourWeeks, adjustments)).toEqual([])
  })

  it('flags a week whose only change is targetStrengthMinutes', () => {
    const withStrength: PlanWeek[] = fourWeeks.map((w, i) => (i === 2 ? { ...w, targetStrengthMinutes: 60 } : w))
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'build', focus: 'S3', targetWeeklyMinutes: 360, targetStrengthMinutes: 30 }]
    const changes = diffPlanWeeks(withStrength, adjustments)
    expect(changes).toHaveLength(1)
    expect(changes[0].before.targetStrengthMinutes).toBe(60)
    expect(changes[0].after.targetStrengthMinutes).toBe(30)
  })
})

describe('applyRecalibration', () => {
  it('updates only the adjusted weeks, leaving the rest untouched', () => {
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 }]
    const result = applyRecalibration(fourWeeks, adjustments)
    expect(result[2].focus).toBe('S3 allégée')
    expect(result[2].targetWeeklyMinutes).toBe(300)
    expect(result[2].phase).toBe('base')
    // Untouched weeks keep their original content and identity of values.
    expect(result[0]).toEqual(fourWeeks[0])
    expect(result[3]).toEqual(fourWeeks[3])
  })

  it('never touches the week skeleton (dates/weekNumber)', () => {
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 }]
    const result = applyRecalibration(fourWeeks, adjustments)
    expect(result[2].startDate).toBe(fourWeeks[2].startDate)
    expect(result[2].endDate).toBe(fourWeeks[2].endDate)
    expect(result[2].weekNumber).toBe(fourWeeks[2].weekNumber)
  })

  it('clears cached sampleSessions on a week whose content changed', () => {
    const withSessions: PlanWeek[] = fourWeeks.map((w, i) => (i === 2 ? { ...w, sampleSessions: [] } : w))
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 }]
    const result = applyRecalibration(withSessions, adjustments)
    expect(result[2].sampleSessions).toBeUndefined()
  })

  it('keeps cached sampleSessions on a week whose content did not change', () => {
    const withSessions: PlanWeek[] = fourWeeks.map((w, i) => (i === 2 ? { ...w, sampleSessions: [] } : w))
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'build', focus: 'S3', targetWeeklyMinutes: 360 }]
    const result = applyRecalibration(withSessions, adjustments)
    expect(result[2].sampleSessions).toEqual([])
  })

  it('applies an optional note, and drops a previous note when none is given', () => {
    const withNote: PlanWeek[] = fourWeeks.map((w, i) => (i === 2 ? { ...w, notes: 'ancienne note' } : w))
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300, notes: 'nouvelle note' }]
    const result = applyRecalibration(withNote, adjustments)
    expect(result[2].notes).toBe('nouvelle note')

    const adjustmentsNoNote: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'base', focus: 'S3 allégée', targetWeeklyMinutes: 300 }]
    const result2 = applyRecalibration(withNote, adjustmentsNoNote)
    expect(result2[2].notes).toBeUndefined()
  })

  it('leaves a week with no matching adjustment completely unchanged', () => {
    const result = applyRecalibration(fourWeeks, [])
    expect(result).toEqual(fourWeeks)
  })

  it('applies an adjusted targetStrengthMinutes, and drops a previous one when none is given', () => {
    const withStrength: PlanWeek[] = fourWeeks.map((w, i) => (i === 2 ? { ...w, targetStrengthMinutes: 60 } : w))
    const adjustments: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'build', focus: 'S3', targetWeeklyMinutes: 360, targetStrengthMinutes: 30 }]
    const result = applyRecalibration(withStrength, adjustments)
    expect(result[2].targetStrengthMinutes).toBe(30)

    const adjustmentsNoStrength: PlanWeekAdjustment[] = [{ weekNumber: 3, phase: 'build', focus: 'S3 sans muscu', targetWeeklyMinutes: 360 }]
    const result2 = applyRecalibration(withStrength, adjustmentsNoStrength)
    expect(result2[2].targetStrengthMinutes).toBeUndefined()
  })
})

/** Séance minimale suffisante pour ces tests — seul le titre sert à distinguer les séances entre elles, les autres champs requis par le schéma AI sont juste renseignés pour satisfaire le type. */
function minimalSession(title: string): PlanWeekSessionWithValidation {
  return {
    sessionKind: 'cycling',
    title,
    sportType: 'Ride',
    durationMinutes: 60,
    intensityLabel: 'Endurance',
    rationale: 'test',
  }
}

describe('distributeWeekdayOffsets', () => {
  it('returns an empty array for zero sessions', () => {
    expect(distributeWeekdayOffsets(0)).toEqual([])
  })

  it('places a single session mid-week', () => {
    expect(distributeWeekdayOffsets(1)).toEqual([3])
  })

  it('spreads two sessions with rest days on both sides and in between', () => {
    expect(distributeWeekdayOffsets(2)).toEqual([1, 5])
  })

  it('spreads three sessions across the week, never on consecutive days', () => {
    const offsets = distributeWeekdayOffsets(3)
    expect(offsets).toEqual([1, 3, 5])
  })

  it('never returns an offset past Sunday (6), however many sessions are given', () => {
    const offsets = distributeWeekdayOffsets(8)
    expect(offsets.every((o) => o >= 0 && o <= 6)).toBe(true)
    expect(offsets).toHaveLength(8)
  })

  it('returns offsets in non-decreasing order (chronological within the week)', () => {
    const offsets = distributeWeekdayOffsets(5)
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThanOrEqual(offsets[i - 1])
  })
})

describe('assignSessionDates', () => {
  const week: PlanWeekSkeleton = { weekNumber: 1, startDate: '2026-09-07', endDate: '2026-09-13' } // a real Monday

  it('assigns a date within the week to each session', () => {
    const sessions = [minimalSession('A'), minimalSession('B'), minimalSession('C')]
    const dated = assignSessionDates(week, sessions)
    expect(dated.map((s) => s.date)).toEqual(['2026-09-08', '2026-09-10', '2026-09-12']) // Tue/Thu/Sat
  })

  it('preserves every other field of the session untouched', () => {
    const dated = assignSessionDates(week, [minimalSession('Séance seuil')])
    expect(dated[0].title).toBe('Séance seuil')
    expect(dated[0].sportType).toBe('Ride')
  })

  it('returns an empty array for an empty session list', () => {
    expect(assignSessionDates(week, [])).toEqual([])
  })
})

describe('clampDateToWeek', () => {
  const week: PlanWeekSkeleton = { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20' }

  it('passes through a date already inside the week', () => {
    expect(clampDateToWeek('2026-09-17', week)).toBe('2026-09-17')
  })

  it('clamps a date before the week to the week start', () => {
    expect(clampDateToWeek('2026-09-01', week)).toBe('2026-09-14')
  })

  it('clamps a date after the week to the week end', () => {
    expect(clampDateToWeek('2026-10-01', week)).toBe('2026-09-20')
  })

  it('accepts the exact boundary dates unchanged', () => {
    expect(clampDateToWeek(week.startDate, week)).toBe(week.startDate)
    expect(clampDateToWeek(week.endDate, week)).toBe(week.endDate)
  })
})

describe('nextAvailableWeekDate', () => {
  const week: PlanWeekSkeleton = { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20' }
  const sessions = [
    { sessionKind: 'cycling', date: '2026-09-14' },
    { sessionKind: 'cycling', date: '2026-09-16' },
    { sessionKind: 'strength', date: '2026-09-17' },
  ] as unknown as PlanWeekSessionWithValidation[]

  it('returns the from-date itself when it is free', () => {
    expect(nextAvailableWeekDate(week, sessions, 1, '2026-09-15')).toBe('2026-09-15')
  })

  it('skips days already taken by another session', () => {
    // 09-16 (this session, excluded) is free from itself; but starting from
    // 09-14 (taken), the next free day is 09-15
    expect(nextAvailableWeekDate(week, sessions, 1, '2026-09-14')).toBe('2026-09-15')
  })

  it('excludes the session being moved from the "taken" set', () => {
    // session index 1 owns 09-16 — searching from there should return 09-16 itself, not skip past it
    expect(nextAvailableWeekDate(week, sessions, 1, '2026-09-16')).toBe('2026-09-16')
  })

  it('clamps a from-date before the week to the week start', () => {
    expect(nextAvailableWeekDate(week, sessions, 1, '2026-09-01')).toBe('2026-09-15')
  })

  it('returns null when the from-date is already past the week end', () => {
    expect(nextAvailableWeekDate(week, sessions, 1, '2026-09-21')).toBeNull()
  })

  it('returns null when every remaining day in the week is already taken', () => {
    const fullWeek = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']
      .map((date) => ({ sessionKind: 'cycling', date }) as unknown as PlanWeekSessionWithValidation)
    expect(nextAvailableWeekDate(week, fullWeek, -1, '2026-09-14')).toBeNull()
  })

  it('ignores sessions with no assigned date', () => {
    const withUndated = [...sessions, { sessionKind: 'cycling' } as unknown as PlanWeekSessionWithValidation]
    expect(nextAvailableWeekDate(week, withUndated, 1, '2026-09-14')).toBe('2026-09-15')
  })
})

describe('planAutoRescheduleMoves', () => {
  const week: PlanWeekSkeleton = { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20' }
  const todayIso = '2026-09-17' // Thursday

  it('moves a missed session to the next free day from tomorrow', () => {
    const sessions = [
      { title: 'Sortie tempo', sessionKind: 'cycling', date: '2026-09-15' }, // Tue, missed
      { title: 'Muscu', sessionKind: 'strength', date: '2026-09-19' },
    ] as unknown as PlanWeekSessionWithValidation[]
    const statuses: SessionCompletionStatus[] = ['missed', 'upcoming']
    const moves = planAutoRescheduleMoves(week, sessions, statuses, todayIso)
    expect(moves).toEqual([{ sessionIndex: 0, title: 'Sortie tempo', fromDate: '2026-09-15', toDate: '2026-09-18' }])
  })

  it('produces no move for a session that is not missed', () => {
    const sessions = [
      { title: 'Sortie tempo', sessionKind: 'cycling', date: '2026-09-19' },
    ] as unknown as PlanWeekSessionWithValidation[]
    const statuses: SessionCompletionStatus[] = ['upcoming']
    expect(planAutoRescheduleMoves(week, sessions, statuses, todayIso)).toEqual([])
  })

  it('never proposes a day already taken, and keeps a missed session in place if the week is full from tomorrow', () => {
    const sessions = [
      { title: 'Manquée', sessionKind: 'cycling', date: '2026-09-15' },
      { title: 'Vendredi', sessionKind: 'cycling', date: '2026-09-18' },
      { title: 'Samedi', sessionKind: 'cycling', date: '2026-09-19' },
      { title: 'Dimanche', sessionKind: 'cycling', date: '2026-09-20' },
    ] as unknown as PlanWeekSessionWithValidation[]
    const statuses: SessionCompletionStatus[] = ['missed', 'upcoming', 'upcoming', 'upcoming']
    expect(planAutoRescheduleMoves(week, sessions, statuses, todayIso)).toEqual([])
  })

  it('resolves two missed sessions the same week without colliding', () => {
    const sessions = [
      { title: 'Lundi manquée', sessionKind: 'cycling', date: '2026-09-14' },
      { title: 'Mardi manquée', sessionKind: 'cycling', date: '2026-09-15' },
    ] as unknown as PlanWeekSessionWithValidation[]
    const statuses: SessionCompletionStatus[] = ['missed', 'missed']
    const moves = planAutoRescheduleMoves(week, sessions, statuses, todayIso)
    expect(moves).toEqual([
      { sessionIndex: 0, title: 'Lundi manquée', fromDate: '2026-09-14', toDate: '2026-09-18' },
      { sessionIndex: 1, title: 'Mardi manquée', fromDate: '2026-09-15', toDate: '2026-09-19' },
    ])
  })

  it('leaves a missed session with no date untouched', () => {
    const sessions = [
      { title: 'Sans date', sessionKind: 'cycling' },
    ] as unknown as PlanWeekSessionWithValidation[]
    const statuses: SessionCompletionStatus[] = ['missed']
    expect(planAutoRescheduleMoves(week, sessions, statuses, todayIso)).toEqual([])
  })
})

describe('assignSessionDatesByAvailability', () => {
  const week: PlanWeekSkeleton = { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20' } // Lun 14 -> Dim 20

  const session = (title: string, durationMinutes: number) =>
    ({ title, durationMinutes } as unknown as PlanWeekSessionWithValidation)

  it('places the single session on the day with the most availability', () => {
    // Lun=30, Mar=90, Mer=0, Jeu=60, Ven=30, Sam=120, Dim=90
    const availability: WeekdayAvailabilityMinutes = [30, 90, 0, 60, 30, 120, 90]
    const result = assignSessionDatesByAvailability(week, [session('Sortie', 60)], availability)
    expect(result[0].date).toBe('2026-09-19') // Samedi, la plus grande capacité
  })

  it('places the largest session first, spreading across the highest-capacity days', () => {
    // Dimanche (100) unique 2e plus grande capacité — Mardi (90) écarté
    // volontairement de cette valeur pour ne pas créer d'égalité avec lui
    // (le départage par index de jour choisirait sinon Mardi, plus tôt
    // dans la semaine, avant Dimanche).
    const availability: WeekdayAvailabilityMinutes = [30, 90, 0, 60, 30, 120, 100]
    const sessions = [session('Longue sortie', 180), session('Séance courte', 45)]
    const result = assignSessionDatesByAvailability(week, sessions, availability)
    // La plus longue (180) va sur Samedi (120, la plus grande capacité) ;
    // la plus courte (45) va ensuite sur la 2e plus grande capacité restante
    // (Dimanche, 100, puisque Samedi est déjà entamé).
    expect(result[0].date).toBe('2026-09-19') // Samedi
    expect(result[1].date).toBe('2026-09-20') // Dimanche
  })

  it('degrades to a deterministic round-robin when no availability is set (all zero)', () => {
    const availability: WeekdayAvailabilityMinutes = [0, 0, 0, 0, 0, 0, 0]
    const sessions = [session('A', 60), session('B', 60), session('C', 60)]
    const result = assignSessionDatesByAvailability(week, sessions, availability)
    expect(result.map((s) => s.date)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']) // Lun, Mar, Mer
  })

  it('never refuses a placement even when every day is already saturated', () => {
    const availability: WeekdayAvailabilityMinutes = [30, 30, 30, 30, 30, 30, 30]
    const sessions = [session('A', 300), session('B', 300), session('C', 300), session('D', 300), session('E', 300), session('F', 300), session('G', 300), session('H', 300)]
    const result = assignSessionDatesByAvailability(week, sessions, availability)
    expect(result).toHaveLength(8)
    expect(result.every((s) => !!s.date)).toBe(true)
  })

  it('returns an empty array for no sessions', () => {
    const availability: WeekdayAvailabilityMinutes = [60, 60, 60, 60, 60, 60, 60]
    expect(assignSessionDatesByAvailability(week, [], availability)).toEqual([])
  })
})

describe('matchSessionCompletion', () => {
  const today = '2026-09-10'

  it('returns unscheduled for a session with no assigned date (pre-dated-plan cache)', () => {
    expect(matchSessionCompletion({ sessionKind: 'cycling' }, 1, 0, today, [], [])).toEqual({ status: 'unscheduled' })
  })

  it('matches a cycling session to a real activity on the same date', () => {
    const activities = [{ id: 'act-1', startDate: '2026-09-08', durationMinutes: 95 }]
    const result = matchSessionCompletion({ sessionKind: 'cycling', date: '2026-09-08' }, 1, 0, today, activities, [])
    expect(result).toEqual({ status: 'done', actualDate: '2026-09-08', actualDurationMinutes: 95, activityId: 'act-1' })
  })

  it('marks a past cycling session with no matching activity as missed', () => {
    const result = matchSessionCompletion({ sessionKind: 'cycling', date: '2026-09-08' }, 1, 0, today, [], [])
    expect(result).toEqual({ status: 'missed' })
  })

  it('marks a future cycling session as upcoming, never missed', () => {
    const result = matchSessionCompletion({ sessionKind: 'cycling', date: '2026-09-12' }, 1, 0, today, [], [])
    expect(result).toEqual({ status: 'upcoming' })
  })

  it('treats a session dated today with no match yet as upcoming, not missed', () => {
    const result = matchSessionCompletion({ sessionKind: 'cycling', date: today }, 1, 0, today, [], [])
    expect(result.status).toBe('upcoming')
  })

  it('matches a strength session to its log via planWeekNumber+planSessionIndex, not date', () => {
    const logs = [{ date: '2026-09-09', planWeekNumber: 1, planSessionIndex: 2 }] // logged a day late — date alone would miss it
    const result = matchSessionCompletion({ sessionKind: 'strength', date: '2026-09-08' }, 1, 2, today, [], logs)
    expect(result).toEqual({ status: 'done', actualDate: '2026-09-09' })
  })

  it('does not cross-match a strength log from a different session index in the same week', () => {
    const logs = [{ date: '2026-09-08', planWeekNumber: 1, planSessionIndex: 0 }]
    const result = matchSessionCompletion({ sessionKind: 'strength', date: '2026-09-08' }, 1, 2, today, [], logs)
    expect(result.status).toBe('missed')
  })

  it('does not cross-match a strength log from the same session index in a different week', () => {
    const logs = [{ date: '2026-09-08', planWeekNumber: 2, planSessionIndex: 0 }]
    const result = matchSessionCompletion({ sessionKind: 'strength', date: '2026-09-08' }, 1, 0, today, [], logs)
    expect(result.status).toBe('missed')
  })

  it('never matches a cycling session against strength logs or vice versa', () => {
    const activities = [{ id: 'act-1', startDate: '2026-09-08', durationMinutes: 60 }]
    const result = matchSessionCompletion({ sessionKind: 'strength', date: '2026-09-08' }, 1, 0, today, activities, [])
    expect(result.status).toBe('missed')
  })

  it('defaults to cycling matching when sessionKind is absent (legacy cached session)', () => {
    const activities = [{ id: 'act-1', startDate: '2026-09-08', durationMinutes: 60 }]
    const result = matchSessionCompletion({ date: '2026-09-08' }, 1, 0, today, activities, [])
    expect(result.status).toBe('done')
  })

  it('carries the matched activity id for a done cycling session', () => {
    const activities = [{ id: 'act-42', startDate: '2026-09-08', durationMinutes: 60 }]
    const result = matchSessionCompletion({ sessionKind: 'cycling', date: '2026-09-08' }, 1, 0, today, activities, [])
    expect(result.activityId).toBe('act-42')
  })

  it('never sets an activityId for a done strength session', () => {
    const logs = [{ date: '2026-09-08', planWeekNumber: 1, planSessionIndex: 0 }]
    const result = matchSessionCompletion({ sessionKind: 'strength', date: '2026-09-08' }, 1, 0, today, [], logs)
    expect(result.activityId).toBeUndefined()
  })
})

function minimalStrengthSession(title: string): PlanWeekSessionWithValidation {
  return {
    sessionKind: 'strength',
    title,
    sportType: 'WeightTraining',
    durationMinutes: 45,
    intensityLabel: 'Force',
    rationale: 'test',
  }
}

describe('findWeekStrengthSession', () => {
  const baseWeek: PlanWeek = { weekNumber: 3, startDate: '2026-09-07', endDate: '2026-09-13', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 360 }

  it('returns null for a null week', () => {
    expect(findWeekStrengthSession(null)).toBeNull()
  })

  it('returns null for a week with no sampleSessions yet', () => {
    expect(findWeekStrengthSession(baseWeek)).toBeNull()
  })

  it('returns null for a week whose sessions are all cycling', () => {
    const week = { ...baseWeek, sampleSessions: [minimalSession('Endurance'), minimalSession('Seuil')] }
    expect(findWeekStrengthSession(week)).toBeNull()
  })

  it('finds the first strength session among mixed cycling/strength sessions, with its index and weekNumber', () => {
    const week = { ...baseWeek, sampleSessions: [minimalSession('Endurance'), minimalStrengthSession('Force bas du corps'), minimalSession('Seuil')] }
    const result = findWeekStrengthSession(week)
    expect(result).toEqual({ session: week.sampleSessions[1], index: 1, weekNumber: 3 })
  })

  it('returns the first strength session when several exist', () => {
    const week = { ...baseWeek, sampleSessions: [minimalStrengthSession('Force A'), minimalStrengthSession('Force B')] }
    expect(findWeekStrengthSession(week)?.index).toBe(0)
  })
})

describe('computePlanProgress', () => {
  const plan = { eventDate: '2026-10-15' }
  const today = '2026-10-01'
  const week: PlanWeek = { weekNumber: 3, startDate: '2026-09-28', endDate: '2026-10-04', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 360 }
  const completion = (status: SessionCompletionStatus): SessionCompletion => ({ status })

  it('computes days remaining until plan.eventDate, regardless of week state', () => {
    const result = computePlanProgress(plan, null, [], today)
    expect(result.daysRemaining).toBe(14)
  })

  it('returns a negative daysRemaining when the event has already passed — never hidden', () => {
    const result = computePlanProgress({ eventDate: '2026-09-20' }, null, [], today)
    expect(result.daysRemaining).toBe(-11)
  })

  it('returns null weekCompletionPercent when the current week has no sampleSessions yet — never a misleading 0%', () => {
    const result = computePlanProgress(plan, week, [], today)
    expect(result.weekCompletionPercent).toBeNull()
    expect(result.sessionsTotal).toBe(0)
  })

  it('computes the completion percent from the current week sessions only', () => {
    const withSessions = { ...week, sampleSessions: [minimalSession('A'), minimalSession('B'), minimalSession('C'), minimalSession('D')] }
    const completions = [completion('done'), completion('done'), completion('missed'), completion('upcoming')]
    const result = computePlanProgress(plan, withSessions, completions, today)
    expect(result).toEqual({ daysRemaining: 14, weekCompletionPercent: 50, sessionsDone: 2, sessionsTotal: 4 })
  })

  it('rounds a non-exact completion percent', () => {
    const withSessions = { ...week, sampleSessions: [minimalSession('A'), minimalSession('B'), minimalSession('C')] }
    const completions = [completion('done'), completion('missed'), completion('missed')]
    const result = computePlanProgress(plan, withSessions, completions, today)
    expect(result.weekCompletionPercent).toBe(33)
  })

  it('never counts a done status from a session outside the current week — caller passes only the relevant completions', () => {
    const withSessions = { ...week, sampleSessions: [minimalSession('A')] }
    const result = computePlanProgress(plan, withSessions, [completion('done')], today)
    expect(result).toEqual({ daysRemaining: 14, weekCompletionPercent: 100, sessionsDone: 1, sessionsTotal: 1 })
  })
})

describe('computeWeeklyAdherence', () => {
  const today = '2026-10-05'
  const completionFor = (map: Record<string, SessionCompletion>) =>
    (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number): SessionCompletion =>
      map[`${week.weekNumber}-${index}`] ?? { status: 'upcoming' }

  it('excludes weeks without sampleSessions — nothing to compare, never a fabricated 0%', () => {
    const noSessions: PlanWeek = { weekNumber: 1, startDate: '2026-09-01', endDate: '2026-09-07', phase: 'base', focus: 'Base', targetWeeklyMinutes: 300 }
    expect(computeWeeklyAdherence([noSessions], completionFor({}), today)).toEqual([])
  })

  it('excludes weeks that have not started yet, even if they somehow carry sampleSessions', () => {
    const future: PlanWeek = {
      weekNumber: 9, startDate: '2026-11-01', endDate: '2026-11-07', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300,
      sampleSessions: [minimalSession('A')],
    }
    expect(computeWeeklyAdherence([future], completionFor({}), today)).toEqual([])
  })

  it('sums planned minutes from every sample session, and completed minutes only from done ones', () => {
    const week: PlanWeek = {
      weekNumber: 2, startDate: '2026-09-28', endDate: '2026-10-04', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300,
      sampleSessions: [minimalSession('A'), minimalSession('B'), minimalSession('C')], // 60min each
    }
    const result = computeWeeklyAdherence(
      [week],
      completionFor({ '2-0': { status: 'done' }, '2-1': { status: 'missed' } }),
      today
    )
    expect(result).toEqual([{
      weekNumber: 2, startDate: '2026-09-28', plannedMinutes: 180, completedMinutes: 60,
      sessionsPlanned: 3, sessionsDone: 1, sessionsMissed: 1,
    }])
  })

  it('prefers the real activity duration over the planned one for a done cycling session', () => {
    const week: PlanWeek = {
      weekNumber: 2, startDate: '2026-09-28', endDate: '2026-10-04', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300,
      sampleSessions: [minimalSession('A')], // planned 60min
    }
    const result = computeWeeklyAdherence(
      [week],
      completionFor({ '2-0': { status: 'done', actualDurationMinutes: 75 } }),
      today
    )
    expect(result[0].completedMinutes).toBe(75)
  })

  it('sorts by week number ascending and caps to the most recent maxWeeks', () => {
    const weeks: PlanWeek[] = [1, 2, 3, 4].map((n) => ({
      weekNumber: n, startDate: `2026-09-0${n}`, endDate: `2026-09-0${n + 6}`, phase: 'build', focus: 'Volume', targetWeeklyMinutes: 60,
      sampleSessions: [minimalSession(`W${n}`)],
    }))
    const result = computeWeeklyAdherence(weeks, completionFor({}), today, 2)
    expect(result.map((w) => w.weekNumber)).toEqual([3, 4])
  })
})

describe('rollingWindowDates', () => {
  it('returns 7 consecutive calendar dates starting from today (inclusive)', () => {
    expect(rollingWindowDates('2026-09-16')).toEqual([
      '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22',
    ])
  })
})

describe('weekdayAvailabilityForDate', () => {
  // Lundi→Dimanche, même ordre que buildPlanWeekSkeleton.
  const availability: WeekdayAvailabilityMinutes = [10, 20, 30, 40, 50, 60, 70]

  it('maps a Monday to index 0', () => {
    expect(weekdayAvailabilityForDate('2026-09-14', availability)).toBe(10) // Lundi
  })

  it('maps a Sunday to index 6', () => {
    expect(weekdayAvailabilityForDate('2026-09-20', availability)).toBe(70) // Dimanche
  })

  it('maps a Wednesday to index 2', () => {
    expect(weekdayAvailabilityForDate('2026-09-16', availability)).toBe(30) // Mercredi
  })
})

describe('sessionsForRollingWindow', () => {
  // Semaine courante : Lundi 2026-09-14 → Dimanche 2026-09-20.
  const week1: PlanWeek = {
    weekNumber: 1, startDate: '2026-09-14', endDate: '2026-09-20', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300,
    sampleSessions: [
      { ...minimalSession('Endurance'), date: '2026-09-16' }, // Mercredi
      { ...minimalSession('Seuil'), date: '2026-09-19' }, // Samedi
    ],
  }
  // Semaine suivante : Lundi 2026-09-21 → Dimanche 2026-09-27.
  const week2: PlanWeek = {
    weekNumber: 2, startDate: '2026-09-21', endDate: '2026-09-27', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300,
    sampleSessions: [
      { ...minimalSession('Endurance longue'), date: '2026-09-21' }, // Lundi
    ],
  }

  it('resolves each rolling date to its own session list, matched by date', () => {
    // Aujourd'hui = Mercredi 2026-09-16 → fenêtre 09-16..09-22, chevauche week1 et week2.
    const result = sessionsForRollingWindow([week1, week2], '2026-09-16')
    expect(result.map((d) => d.date)).toEqual([
      '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22',
    ])
    expect(result[0].week?.weekNumber).toBe(1)
    expect(result[0].sessions.map((s) => s.session.title)).toEqual(['Endurance'])
    expect(result[3].sessions.map((s) => s.session.title)).toEqual(['Seuil']) // 09-19
    expect(result[5].week?.weekNumber).toBe(2) // 09-21, déborde dans week2
    expect(result[5].sessions.map((s) => s.session.title)).toEqual(['Endurance longue'])
  })

  it('leaves a day empty (never throws) rather than inventing a session', () => {
    const result = sessionsForRollingWindow([week1, week2], '2026-09-16')
    expect(result[1].sessions).toEqual([]) // 09-17, jeudi, rien de planifié
  })

  it('reports week as null and no sessions for a date outside every known week', () => {
    const result = sessionsForRollingWindow([week1], '2026-09-25') // après la fin de week1, week2 absente
    expect(result.every((d) => d.week === null && d.sessions.length === 0)).toBe(true)
  })

  it('never throws for a week without sampleSessions yet (lazy generation)', () => {
    const ungenerated: PlanWeek = { weekNumber: 3, startDate: '2026-09-28', endDate: '2026-10-04', phase: 'build', focus: 'Volume', targetWeeklyMinutes: 300 }
    const result = sessionsForRollingWindow([ungenerated], '2026-09-29')
    expect(result[0].week?.weekNumber).toBe(3)
    expect(result[0].sessions).toEqual([])
  })
})

describe('recalibrateRollingWindow', () => {
  const week: PlanWeekSkeleton = { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20' } // Lun 14 -> Dim 20
  const session = (title: string, durationMinutes: number, date: string) =>
    ({ title, durationMinutes, date } as unknown as PlanWeekSessionWithValidation)

  it('rebalances upcoming sessions within the rolling window when availability changes, respecting the new per-day capacity', () => {
    const todayIso = '2026-09-16' // Mercredi
    // Lun=60, Mar=60, Mer=0, Jeu=120, Ven=30, Sam=90, Dim=45
    const availability: WeekdayAvailabilityMinutes = [60, 60, 0, 120, 30, 90, 45]
    const sessions = [
      session('Mercredi upcoming', 60, '2026-09-16'),
      session('Vendredi upcoming', 90, '2026-09-18'),
    ]
    const input: RollingWeekInput = { week, sessions, completionStatuses: ['upcoming', 'upcoming'] }
    const { updatedSessionsByWeek, moves, oversizedSessions } = recalibrateRollingWindow([input], availability, todayIso)

    // Le bin-packing traite la plus longue séance (90) en premier — elle
    // obtient le jour de plus grande capacité (Jeudi, 120) ; la plus courte
    // (60) obtient ensuite le prochain jour de plus grande capacité restante
    // (Samedi, 90). `moves` lui-même est produit dans l'ordre des séances
    // d'origine (index 0 puis 1), pas dans l'ordre de traitement du bin-packing.
    expect(moves).toEqual([
      { weekNumber: 2, sessionIndex: 0, title: 'Mercredi upcoming', fromDate: '2026-09-16', toDate: '2026-09-19' },
      { weekNumber: 2, sessionIndex: 1, title: 'Vendredi upcoming', fromDate: '2026-09-18', toDate: '2026-09-17' },
    ])
    expect(updatedSessionsByWeek.get(2)?.map((s) => s.date)).toEqual(['2026-09-19', '2026-09-17'])
    expect(oversizedSessions).toEqual([])
  })

  it('never moves a done or missed session — its day still counts as occupied for the sessions that do move', () => {
    const todayIso = '2026-09-16'
    // Mer=30 seulement, toutes les autres à 30 aussi.
    const availability: WeekdayAvailabilityMinutes = [60, 60, 30, 30, 30, 30, 30]
    const sessions = [
      session('Déjà faite', 30, '2026-09-16'), // Mercredi, done — sature déjà le jour
      session('À déplacer', 45, '2026-09-18'), // Vendredi, upcoming
    ]
    const input: RollingWeekInput = { week, sessions, completionStatuses: ['done', 'upcoming'] }
    const { moves, oversizedSessions } = recalibrateRollingWindow([input], availability, todayIso)

    // Mercredi déjà à 0 restant (30-30) — la séance à déplacer va sur le
    // prochain jour disponible (Jeudi, premier jour à égalité de capacité).
    expect(moves).toEqual([{ weekNumber: 2, sessionIndex: 1, title: 'À déplacer', fromDate: '2026-09-18', toDate: '2026-09-17' }])
    // 45 min sur un jour à 30 min de capacité — signalé, jamais résolu automatiquement.
    expect(oversizedSessions).toEqual([{ weekNumber: 2, sessionIndex: 1, title: 'À déplacer', date: '2026-09-17', durationMinutes: 45, availableMinutes: 30 }])
  })

  it('leaves a week entirely outside the rolling window untouched — absent from updatedSessionsByWeek', () => {
    const todayIso = '2026-09-16'
    const pastWeek: PlanWeekSkeleton = { weekNumber: 1, startDate: '2026-09-07', endDate: '2026-09-13' }
    const sessions = [session('Semaine passée', 60, '2026-09-09')]
    const input: RollingWeekInput = { week: pastWeek, sessions, completionStatuses: ['missed'] }
    const availability: WeekdayAvailabilityMinutes = [60, 60, 60, 60, 60, 60, 60]
    const { updatedSessionsByWeek, moves, oversizedSessions } = recalibrateRollingWindow([input], availability, todayIso)
    expect(updatedSessionsByWeek.size).toBe(0)
    expect(moves).toEqual([])
    expect(oversizedSessions).toEqual([])
  })

  it('ignores a session with no assigned date, regardless of its status', () => {
    const todayIso = '2026-09-16'
    const sessions = [{ title: 'Sans date', durationMinutes: 60 } as unknown as PlanWeekSessionWithValidation]
    const input: RollingWeekInput = { week, sessions, completionStatuses: ['upcoming'] }
    const availability: WeekdayAvailabilityMinutes = [60, 60, 60, 60, 60, 60, 60]
    const { updatedSessionsByWeek, moves } = recalibrateRollingWindow([input], availability, todayIso)
    expect(updatedSessionsByWeek.size).toBe(0)
    expect(moves).toEqual([])
  })

  it('produces no move when the best available day is already the session\'s current day', () => {
    const todayIso = '2026-09-20' // Dimanche, dernier jour de la semaine — la fenêtre glissante n'y recoupe qu'un seul jour de cette semaine.
    const availability: WeekdayAvailabilityMinutes = [60, 60, 60, 60, 60, 60, 60]
    const sessions = [session('Dimanche', 60, '2026-09-20')]
    const input: RollingWeekInput = { week, sessions, completionStatuses: ['upcoming'] }
    const { updatedSessionsByWeek, moves } = recalibrateRollingWindow([input], availability, todayIso)
    expect(moves).toEqual([])
    expect(updatedSessionsByWeek.size).toBe(0)
  })
})
