import { describe, it, expect } from 'vitest'
import { isDeleteConfirmed, getDeleteAccountErrorMessage, DELETE_CONFIRM_WORD } from './danger-zone-types'

describe('isDeleteConfirmed', () => {
  it('confirms on an exact match of the confirm word', () => {
    expect(isDeleteConfirmed(DELETE_CONFIRM_WORD)).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isDeleteConfirmed('')).toBe(false)
  })

  it('rejects a partial match', () => {
    expect(isDeleteConfirmed('SUPPRIM')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isDeleteConfirmed('supprimer')).toBe(false)
  })

  it('rejects the word with surrounding whitespace', () => {
    expect(isDeleteConfirmed(' SUPPRIMER ')).toBe(false)
  })

  it('rejects an unrelated word', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(false)
  })
})

describe('getDeleteAccountErrorMessage', () => {
  it('returns the re-login message for auth/requires-recent-login', () => {
    const msg = getDeleteAccountErrorMessage('auth/requires-recent-login')
    expect(msg.title).toBe('Reconnexion requise')
    expect(msg.description).toMatch(/reconnectez-vous/)
  })

  it('returns a generic message for an unrecognized error code', () => {
    const msg = getDeleteAccountErrorMessage('auth/network-request-failed')
    expect(msg.title).toBe('Erreur')
  })

  it('returns a generic message when no error code is present', () => {
    const msg = getDeleteAccountErrorMessage(undefined)
    expect(msg.title).toBe('Erreur')
  })
})
