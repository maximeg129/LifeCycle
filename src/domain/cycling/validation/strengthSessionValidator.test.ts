import { describe, it, expect } from 'vitest'
import {
  checkPatternCoverage,
  checkHipHingePresence,
  checkCorePlanes,
  checkLoadRepsRestConsistency,
  checkSessionDuration,
  checkWeeklyStrengthFrequency,
  checkTimingBeforeKeySession,
  validateStrengthSession,
  type MovementPattern,
  type StrengthExerciseForValidation,
  type StrengthSessionValidationInput,
} from './strengthSessionValidator'

const ex = (overrides: Partial<StrengthExerciseForValidation> = {}): StrengthExerciseForValidation => ({
  pattern: 'bilateral-heavy',
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  pct1RMMin: 60,
  pct1RMMax: 70,
  restSeconds: 100,
  ...overrides,
})

describe('checkPatternCoverage', () => {
  it('blocks a "principale" session missing bilateral-heavy even with 4+ other patterns', () => {
    const patterns: MovementPattern[] = ['hip-hinge', 'unilateral', 'anti-extension', 'anti-rotation-lateral']
    const result = checkPatternCoverage('principale', patterns)
    expect(result.verdict).toBe('block')
    expect(result.detail).toContain('Bilatéral lourd absent')
  })

  it('blocks a "principale" session with bilateral-heavy but fewer than 4 distinct patterns', () => {
    const patterns: MovementPattern[] = ['bilateral-heavy', 'hip-hinge', 'unilateral']
    expect(checkPatternCoverage('principale', patterns).verdict).toBe('block')
  })

  it('passes a "principale" session covering exactly 4 patterns including bilateral-heavy', () => {
    const patterns: MovementPattern[] = ['bilateral-heavy', 'hip-hinge', 'unilateral', 'anti-extension']
    expect(checkPatternCoverage('principale', patterns).verdict).toBe('ok')
  })

  it('never counts a duplicated pattern twice toward the 4-pattern minimum', () => {
    const patterns: MovementPattern[] = ['bilateral-heavy', 'bilateral-heavy', 'hip-hinge', 'unilateral']
    expect(checkPatternCoverage('principale', patterns).verdict).toBe('block')
  })

  it('exempts an "entretien" session from the pattern-coverage requirement entirely', () => {
    expect(checkPatternCoverage('entretien', ['unilateral']).verdict).toBe('ok')
  })

  it('exempts a "top-up" session from the pattern-coverage requirement entirely', () => {
    expect(checkPatternCoverage('top-up', []).verdict).toBe('ok')
  })
})

describe('checkHipHingePresence', () => {
  it('passes when hip-hinge is present in the current session', () => {
    expect(checkHipHingePresence(['hip-hinge'], []).verdict).toBe('ok')
  })

  it('passes when hip-hinge is absent now but was present in one of the last 2 sessions', () => {
    const previous: MovementPattern[][] = [['bilateral-heavy'], ['hip-hinge']]
    expect(checkHipHingePresence(['bilateral-heavy'], previous).verdict).toBe('ok')
  })

  it('warns when hip-hinge is absent now and from the last 2 sessions', () => {
    const previous: MovementPattern[][] = [['bilateral-heavy'], ['unilateral']]
    expect(checkHipHingePresence(['bilateral-heavy'], previous).verdict).toBe('warn')
  })

  it('only looks at the last 2 sessions, not further back', () => {
    const previous: MovementPattern[][] = [['hip-hinge'], ['bilateral-heavy'], ['unilateral']]
    expect(checkHipHingePresence(['bilateral-heavy'], previous).verdict).toBe('warn')
  })

  it('warns with no history at all and hip-hinge absent', () => {
    expect(checkHipHingePresence(['bilateral-heavy'], []).verdict).toBe('warn')
  })
})

describe('checkCorePlanes', () => {
  it('passes when both core planes are covered', () => {
    expect(checkCorePlanes(['anti-extension', 'anti-rotation-lateral']).verdict).toBe('ok')
  })

  it('warns when only anti-extension is covered', () => {
    const result = checkCorePlanes(['anti-extension'])
    expect(result.verdict).toBe('warn')
  })

  it('warns when only anti-rotation-lateral is covered', () => {
    expect(checkCorePlanes(['anti-rotation-lateral']).verdict).toBe('warn')
  })

  it('is insufficient_data (not a failure) when no core work is present at all', () => {
    expect(checkCorePlanes(['bilateral-heavy']).verdict).toBe('insufficient_data')
  })
})

describe('checkLoadRepsRestConsistency', () => {
  it('passes an exercise fully within the "base" phase bounds', () => {
    const result = checkLoadRepsRestConsistency('base', [ex({ sets: 3, repsMin: 8, repsMax: 12, pct1RMMin: 60, pct1RMMax: 70, restSeconds: 100 })])
    expect(result.verdict).toBe('ok')
  })

  it('flags sets outside the phase bounds', () => {
    const result = checkLoadRepsRestConsistency('base', [ex({ sets: 6 })])
    expect(result.verdict).toBe('warn')
    expect(result.detail).toContain('séries hors')
  })

  it('flags reps outside the phase bounds', () => {
    const result = checkLoadRepsRestConsistency('force-max', [ex({ sets: 4, repsMin: 10, repsMax: 12 })])
    expect(result.verdict).toBe('warn')
    expect(result.detail).toContain('répétitions hors')
  })

  it('flags %1RM outside the phase bounds', () => {
    const result = checkLoadRepsRestConsistency('force-max', [ex({ sets: 4, repsMin: 4, repsMax: 6, pct1RMMin: 50, pct1RMMax: 55, restSeconds: 200 })])
    expect(result.verdict).toBe('warn')
    expect(result.detail).toContain('1RM hors')
  })

  it('flags rest time outside the phase bounds', () => {
    const result = checkLoadRepsRestConsistency('force-max', [ex({ sets: 4, repsMin: 4, repsMax: 6, pct1RMMin: 88, pct1RMMax: 90, restSeconds: 60 })])
    expect(result.verdict).toBe('warn')
    expect(result.detail).toContain('repos')
  })

  it('never flags %1RM when the exercise has none (bodyweight/core work)', () => {
    const result = checkLoadRepsRestConsistency('base', [ex({ pct1RMMin: null, pct1RMMax: null })])
    expect(result.verdict).toBe('ok')
  })

  it('never flags rest when the exercise has none recorded', () => {
    const result = checkLoadRepsRestConsistency('base', [ex({ restSeconds: null })])
    expect(result.verdict).toBe('ok')
  })

  it('tolerates a range that merely overlaps the phase bounds rather than requiring an exact match', () => {
    // repsMin-repsMax = 10-14 overlaps base's 8-12 bound.
    const result = checkLoadRepsRestConsistency('base', [ex({ repsMin: 10, repsMax: 14 })])
    expect(result.verdict).toBe('ok')
  })

  it('is insufficient_data for an empty exercise list', () => {
    expect(checkLoadRepsRestConsistency('base', []).verdict).toBe('insufficient_data')
  })
})

describe('checkSessionDuration', () => {
  it('passes a 45min "principale" session', () => {
    expect(checkSessionDuration('principale', 45).verdict).toBe('ok')
  })

  it('warns a "principale" session over the 50min cap', () => {
    expect(checkSessionDuration('principale', 65).verdict).toBe('warn')
  })

  it('never caps an "entretien" session even at 90min', () => {
    expect(checkSessionDuration('entretien', 90).verdict).toBe('ok')
  })
})

describe('checkWeeklyStrengthFrequency', () => {
  it('imposes no cap when weekly cycling volume is 10h or under', () => {
    expect(checkWeeklyStrengthFrequency(10, 'build', 5).verdict).toBe('ok')
  })

  it('caps at 2 sessions/week in build phase above 10h', () => {
    expect(checkWeeklyStrengthFrequency(12, 'build', 2).verdict).toBe('ok')
    expect(checkWeeklyStrengthFrequency(12, 'build', 3).verdict).toBe('warn')
  })

  it('caps at 1 session/week in peak phase above 10h', () => {
    expect(checkWeeklyStrengthFrequency(12, 'peak', 1).verdict).toBe('ok')
    expect(checkWeeklyStrengthFrequency(12, 'peak', 2).verdict).toBe('warn')
  })

  it('is insufficient_data above 10h for a phase S05 does not specify a cap for', () => {
    expect(checkWeeklyStrengthFrequency(12, 'base', 3).verdict).toBe('insufficient_data')
  })
})

describe('checkTimingBeforeKeySession', () => {
  it('never restricts a "base" or "entretien" phase session', () => {
    expect(checkTimingBeforeKeySession('base', 2).verdict).toBe('ok')
    expect(checkTimingBeforeKeySession('entretien', 2).verdict).toBe('ok')
  })

  it('blocks a "force-max" session under 48h before the next key ride', () => {
    expect(checkTimingBeforeKeySession('force-max', 24).verdict).toBe('block')
  })

  it('blocks a "transfert-puissance" session under 48h before the next key ride', () => {
    expect(checkTimingBeforeKeySession('transfert-puissance', 36).verdict).toBe('block')
  })

  it('passes a heavy session at or beyond the 48h threshold', () => {
    expect(checkTimingBeforeKeySession('force-max', 48).verdict).toBe('ok')
    expect(checkTimingBeforeKeySession('force-max', 72).verdict).toBe('ok')
  })

  it('is insufficient_data for a heavy session with no assigned date yet', () => {
    expect(checkTimingBeforeKeySession('force-max', null).verdict).toBe('insufficient_data')
  })
})

describe('validateStrengthSession', () => {
  const baseInput: StrengthSessionValidationInput = {
    session: {
      sessionType: 'principale',
      strengthPhase: 'base',
      durationMinutes: 45,
      exercises: [
        ex({ pattern: 'bilateral-heavy' }),
        ex({ pattern: 'hip-hinge' }),
        ex({ pattern: 'unilateral' }),
        ex({ pattern: 'anti-extension' }),
        ex({ pattern: 'anti-rotation-lateral' }),
      ],
    },
    previousSessionsPatterns: [],
    weeklyCyclingHours: 8,
    cyclingPhase: 'build',
    strengthSessionsThisWeek: 1,
    hoursBeforeNextKeySession: null,
  }

  it('returns "ok" overall for a fully compliant principal session', () => {
    const summary = validateStrengthSession(baseInput)
    expect(summary.overallVerdict).toBe('ok')
    expect(summary.isMaintenanceOnly).toBe(false)
  })

  it('marks isMaintenanceOnly true for an entretien/top-up session', () => {
    const summary = validateStrengthSession({ ...baseInput, session: { ...baseInput.session, sessionType: 'entretien' } })
    expect(summary.isMaintenanceOnly).toBe(true)
  })

  it('returns "blocked" when the mandatory pattern coverage fails', () => {
    const summary = validateStrengthSession({
      ...baseInput,
      session: { ...baseInput.session, exercises: [ex({ pattern: 'hip-hinge' }), ex({ pattern: 'unilateral' })] },
    })
    expect(summary.overallVerdict).toBe('blocked')
  })

  it('returns "blocked" when a heavy session is placed too close to a key ride', () => {
    const summary = validateStrengthSession({
      ...baseInput,
      session: { ...baseInput.session, strengthPhase: 'force-max' },
      hoursBeforeNextKeySession: 12,
    })
    expect(summary.overallVerdict).toBe('blocked')
  })

  it('returns "to-review" once at least 2 checks warn (here: duration + load/reps/rest matrix)', () => {
    const summary = validateStrengthSession({
      ...baseInput,
      session: {
        ...baseInput.session,
        durationMinutes: 70, // over the 50min cap -> warn
        exercises: [ex({ pattern: 'bilateral-heavy' }), ex({ pattern: 'unilateral' }), ex({ pattern: 'hip-hinge', sets: 99 }), ex({ pattern: 'anti-extension' })], // sets=99 out of "base" bounds -> warn
      },
    })
    expect(summary.overallVerdict).toBe('to-review')
  })
})
