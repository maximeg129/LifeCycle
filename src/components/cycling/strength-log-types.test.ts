import { describe, it, expect } from 'vitest'
import { exerciseHistory, distinctExerciseNames, type StrengthSessionLogWithId } from './strength-log-types'

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
