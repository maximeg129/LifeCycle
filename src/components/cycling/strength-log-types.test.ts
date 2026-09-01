import { describe, it, expect } from 'vitest'
import { exerciseHistory, distinctExerciseNames, formatTimer, summarizeSetsDetail, type StrengthSessionLogWithId } from './strength-log-types'

const logs: StrengthSessionLogWithId[] = [
  {
    id: 'log1',
    userId: 'u1',
    date: '2026-08-10',
    title: 'Force bas du corps',
    exercises: [
      { name: 'Squat', sets: 4, reps: '5', loadKg: 80 },
      { name: 'Fentes bulgares', sets: 3, reps: '8-10', loadKg: 20 },
    ],
  },
  {
    id: 'log2',
    userId: 'u1',
    date: '2026-08-24',
    title: 'Force bas du corps',
    exercises: [
      { name: 'squat', sets: 4, reps: '5', loadKg: 85 }, // different casing, same exercise
    ],
  },
  {
    id: 'log3',
    userId: 'u1',
    date: '2026-08-17',
    title: 'Force bas du corps',
    exercises: [
      { name: 'Squat', sets: 4, reps: '5', loadKg: 82.5 },
    ],
  },
]

describe('exerciseHistory', () => {
  it('finds every occurrence of an exercise across logs, case-insensitively', () => {
    const history = exerciseHistory(logs, 'squat')
    expect(history).toHaveLength(3)
  })

  it('sorts oldest first regardless of input order', () => {
    const history = exerciseHistory(logs, 'Squat')
    expect(history.map((p) => p.date)).toEqual(['2026-08-10', '2026-08-17', '2026-08-24'])
  })

  it('carries through the real logged load, never a derived score', () => {
    const history = exerciseHistory(logs, 'Squat')
    expect(history.map((p) => p.loadKg)).toEqual([80, 82.5, 85])
  })

  it('returns an empty array for an exercise never logged', () => {
    expect(exerciseHistory(logs, 'Développé couché')).toEqual([])
  })

  it('matches an exercise logged only once', () => {
    expect(exerciseHistory(logs, 'Fentes bulgares')).toHaveLength(1)
  })
})

describe('distinctExerciseNames', () => {
  it('lists each distinct exercise once, case-insensitively deduplicated', () => {
    const names = distinctExerciseNames(logs)
    expect(names).toHaveLength(2)
    expect(names.map((n) => n.toLowerCase()).sort()).toEqual(['fentes bulgares', 'squat'])
  })

  it('keeps the casing from the most recently logged occurrence', () => {
    // log2 (2026-08-24, most recent) logs "squat" lowercase.
    const names = distinctExerciseNames(logs)
    expect(names).toContain('squat')
  })

  it('returns an empty array for no logs', () => {
    expect(distinctExerciseNames([])).toEqual([])
  })
})

describe('formatTimer', () => {
  it('formats under a minute as "0:ss"', () => {
    expect(formatTimer(45)).toBe('0:45')
  })

  it('formats minutes and seconds as "m:ss", zero-padded', () => {
    expect(formatTimer(125)).toBe('2:05')
  })

  it('switches to "h:mm:ss" past an hour', () => {
    expect(formatTimer(3661)).toBe('1:01:01')
  })

  it('rounds to the nearest second', () => {
    expect(formatTimer(59.6)).toBe('1:00')
  })

  it('never goes negative — clamps to 0 rather than showing a minus sign', () => {
    expect(formatTimer(-5)).toBe('0:00')
  })

  it('formats exactly 0 as "0:00"', () => {
    expect(formatTimer(0)).toBe('0:00')
  })
})

describe('summarizeSetsDetail', () => {
  it('picks the heaviest set as the representative reps/loadKg', () => {
    const summary = summarizeSetsDetail([{ reps: 6, loadKg: 80 }, { reps: 4, loadKg: 90 }, { reps: 5, loadKg: 85 }])
    expect(summary).toEqual({ sets: 3, reps: '4', loadKg: 90 })
  })

  it('falls back to the last set when no load was recorded (bodyweight exercise)', () => {
    const summary = summarizeSetsDetail([{ reps: 12 }, { reps: 10 }, { reps: 8 }])
    expect(summary).toEqual({ sets: 3, reps: '8' })
  })

  it('counts every set even if only some carry a load', () => {
    const summary = summarizeSetsDetail([{ reps: 10 }, { reps: 8, loadKg: 20 }])
    expect(summary.sets).toBe(2)
    expect(summary.loadKg).toBe(20)
  })

  it('returns a zeroed summary for an empty list rather than throwing', () => {
    expect(summarizeSetsDetail([])).toEqual({ sets: 0, reps: '0' })
  })
})
