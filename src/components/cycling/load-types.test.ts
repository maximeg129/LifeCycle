import { describe, it, expect } from 'vitest'
import { mondayOf } from './load-types'

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-03-23')).toBe('2026-03-23') // a Monday
  })
  it('rolls back to Monday for other days of the week', () => {
    expect(mondayOf('2026-03-25')).toBe('2026-03-23') // Wednesday
    expect(mondayOf('2026-03-29')).toBe('2026-03-23') // Sunday
  })
})
