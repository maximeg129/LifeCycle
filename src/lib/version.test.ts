import { describe, it, expect } from 'vitest'
import { formatVersionLabel } from './version'

describe('formatVersionLabel', () => {
  it('appends the formatted build time when present', () => {
    expect(formatVersionLabel('a1b2c3d', '2026-08-27T09:15:00.000Z')).toMatch(/^a1b2c3d · \d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it('falls back to just the sha when there is no build time', () => {
    expect(formatVersionLabel('a1b2c3d', null)).toBe('a1b2c3d')
  })

  it('falls back to just the sha when the build time is unparsable', () => {
    expect(formatVersionLabel('a1b2c3d', 'not-a-date')).toBe('a1b2c3d')
  })

  it('shows "dev" as-is when no real sha is available', () => {
    expect(formatVersionLabel('dev', null)).toBe('dev')
  })
})
