import { describe, it, expect } from 'vitest'
import { recentStrengthSessionPatterns } from './strength-session-plan-types'
import { buildPlanWeekSkeleton, mergePlanWeeks, type PlanWeek, type PlanWeekSessionWithValidation } from './training-plan-types'
import type { MovementPattern } from '@/domain/cycling/validation/strengthSessionValidator'

function strengthSession(patterns: MovementPattern[]): PlanWeekSessionWithValidation {
  return {
    sessionKind: 'strength',
    title: 'Séance muscu',
    sportType: 'WeightTraining',
    durationMinutes: 45,
    intensityLabel: 'Force',
    rationale: '',
    strengthExercises: patterns.map((pattern) => ({
      name: 'Exercice',
      pattern,
      sets: 3,
      reps: '5',
      repsMin: 5,
      repsMax: 5,
      pct1RMMin: null,
      pct1RMMax: null,
      loadGuidance: '',
      restSeconds: 90,
    })),
  } as PlanWeekSessionWithValidation
}

function cyclingSession(): PlanWeekSessionWithValidation {
  return {
    sessionKind: 'cycling',
    title: 'Endurance',
    sportType: 'Ride',
    durationMinutes: 90,
    intensityLabel: 'Endurance',
    rationale: '',
    structuredWorkout: '- 90m 60% Endurance',
  } as PlanWeekSessionWithValidation
}

const skeleton = buildPlanWeekSkeleton('2026-08-24', 4)

describe('recentStrengthSessionPatterns', () => {
  it('returns an empty array when no prior week has generated sessions', () => {
    const weeks: PlanWeek[] = mergePlanWeeks(skeleton, [
      { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
      { phase: 'base', focus: 'S2', targetWeeklyMinutes: 300 },
      { phase: 'build', focus: 'S3', targetWeeklyMinutes: 300 },
      { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 300 },
    ])
    expect(recentStrengthSessionPatterns(weeks, 3)).toEqual([])
  })

  it('collects patterns only from strength sessions, ignoring cycling sessions', () => {
    const weeks: PlanWeek[] = mergePlanWeeks(skeleton, [
      { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
      { phase: 'base', focus: 'S2', targetWeeklyMinutes: 300 },
      { phase: 'build', focus: 'S3', targetWeeklyMinutes: 300 },
      { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 300 },
    ])
    weeks[0].sampleSessions = [cyclingSession(), strengthSession(['bilateral-heavy', 'hip-hinge'])]
    expect(recentStrengthSessionPatterns(weeks, 2)).toEqual([['bilateral-heavy', 'hip-hinge']])
  })

  it('only considers weeks strictly before beforeWeekNumber', () => {
    const weeks: PlanWeek[] = mergePlanWeeks(skeleton, [
      { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
      { phase: 'base', focus: 'S2', targetWeeklyMinutes: 300 },
      { phase: 'build', focus: 'S3', targetWeeklyMinutes: 300 },
      { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 300 },
    ])
    weeks[2].sampleSessions = [strengthSession(['hip-hinge'])] // week 3 — should NOT count when asking for week 3's own history
    expect(recentStrengthSessionPatterns(weeks, 3)).toEqual([])
  })

  it('keeps only the last 2 strength sessions, oldest first, across multiple weeks', () => {
    const weeks: PlanWeek[] = mergePlanWeeks(skeleton, [
      { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
      { phase: 'base', focus: 'S2', targetWeeklyMinutes: 300 },
      { phase: 'build', focus: 'S3', targetWeeklyMinutes: 300 },
      { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 300 },
    ])
    weeks[0].sampleSessions = [strengthSession(['bilateral-heavy'])]
    weeks[1].sampleSessions = [strengthSession(['hip-hinge'])]
    weeks[2].sampleSessions = [strengthSession(['unilateral'])]
    expect(recentStrengthSessionPatterns(weeks, 4)).toEqual([['hip-hinge'], ['unilateral']])
  })

  it('ignores exercises with no recognizable pattern rather than throwing (legacy cached data)', () => {
    const weeks: PlanWeek[] = mergePlanWeeks(skeleton, [
      { phase: 'base', focus: 'S1', targetWeeklyMinutes: 300 },
      { phase: 'base', focus: 'S2', targetWeeklyMinutes: 300 },
      { phase: 'build', focus: 'S3', targetWeeklyMinutes: 300 },
      { phase: 'taper', focus: 'S4', targetWeeklyMinutes: 300 },
    ])
    const legacySession = strengthSession([])
    legacySession.strengthExercises = [{ name: 'Ancien exercice', sets: 3, reps: '5' } as never]
    weeks[0].sampleSessions = [legacySession]
    expect(() => recentStrengthSessionPatterns(weeks, 2)).not.toThrow()
    expect(recentStrengthSessionPatterns(weeks, 2)).toEqual([[]])
  })
})
