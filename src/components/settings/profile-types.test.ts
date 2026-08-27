import { describe, it, expect } from 'vitest'
import { getProfileInitials } from './profile-types'

describe('getProfileInitials', () => {
  it('uses the first two characters of the display name when present', () => {
    expect(getProfileInitials('Maxime Galichet', 'maxime@example.com')).toBe('MA')
  })

  it('falls back to the email when there is no display name', () => {
    expect(getProfileInitials(null, 'maxime@example.com')).toBe('MA')
  })

  it('falls back to the email when the display name is an empty string', () => {
    expect(getProfileInitials('', 'maxime@example.com')).toBe('MA')
  })

  it('falls back to a placeholder when neither is set', () => {
    expect(getProfileInitials(null, null)).toBe('?')
  })

  it('falls back to a placeholder when neither is set (undefined)', () => {
    expect(getProfileInitials(undefined, undefined)).toBe('?')
  })

  it('uppercases lowercase input', () => {
    expect(getProfileInitials('maxime', null)).toBe('MA')
  })

  it('handles a single-character source without throwing', () => {
    expect(getProfileInitials('M', null)).toBe('M')
  })
})
