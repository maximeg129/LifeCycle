import { describe, it, expect } from 'vitest'
import { feelingScore, feedbackDocIdForActivity, feedbackDocIdForDay } from './session-feedback-types'

describe('feelingScore', () => {
  it('averages feeling and motivation', () => {
    expect(feelingScore('bien', 'bien')).toBe(1)
    expect(feelingScore('bien', 'mauvais')).toBe(0)
    expect(feelingScore('mauvais', 'mauvais')).toBe(-1)
  })
  it('works with only one of the two set', () => {
    expect(feelingScore('bien', undefined)).toBe(1)
    expect(feelingScore(undefined, 'mauvais')).toBe(-1)
  })
  it('is null when neither is set', () => {
    expect(feelingScore(undefined, undefined)).toBeNull()
  })
})

describe('feedbackDocIdForActivity / feedbackDocIdForDay', () => {
  it('uses the activity id verbatim', () => {
    expect(feedbackDocIdForActivity('abc123')).toBe('abc123')
  })
  it('prefixes daily check-ins to avoid colliding with activity ids', () => {
    expect(feedbackDocIdForDay('2026-03-20')).toBe('daily-2026-03-20')
  })
})
