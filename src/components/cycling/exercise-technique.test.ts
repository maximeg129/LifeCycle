import { describe, it, expect } from 'vitest'
import { MOVEMENT_PATTERNS } from '@/domain/cycling/validation/strengthSessionValidator'
import { EXERCISE_TECHNIQUE } from './exercise-technique'

describe('EXERCISE_TECHNIQUE', () => {
  it('covers every movement pattern from the S05 referential', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(EXERCISE_TECHNIQUE[pattern]).toBeDefined()
    }
  })

  it('never has an extra key beyond the known patterns', () => {
    expect(Object.keys(EXERCISE_TECHNIQUE).sort()).toEqual([...MOVEMENT_PATTERNS].sort())
  })

  it('gives every entry a non-empty title and at least 3 cues', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const entry = EXERCISE_TECHNIQUE[pattern]
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.cues.length).toBeGreaterThanOrEqual(3)
      for (const cue of entry.cues) {
        expect(cue.length).toBeGreaterThan(0)
      }
    }
  })
})
