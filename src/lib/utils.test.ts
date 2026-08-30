import { describe, it, expect } from 'vitest'
import { describeActionDispatchError } from './utils'

describe('describeActionDispatchError', () => {
  it('replaces the redacted Next.js production error with an actionable message', () => {
    const e = new Error('An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.')
    expect(describeActionDispatchError(e)).toContain('rouvrez complètement')
  })

  it('passes through a genuine, informative error message unchanged', () => {
    const e = new Error('Failed to fetch')
    expect(describeActionDispatchError(e)).toBe('Failed to fetch')
  })

  it('falls back to the actionable message for a non-Error thrown value', () => {
    expect(describeActionDispatchError('oops')).toContain('rouvrez complètement')
  })

  it('falls back to the actionable message for an empty error message', () => {
    expect(describeActionDispatchError(new Error(''))).toContain('rouvrez complètement')
  })

  // Regression: hit live on ride-analysis "Régénérer" hours after a fresh
  // deploy — a stale-deploy Server Action error that is NOT redacted (so
  // the old check for "Server Components render" missed it entirely),
  // showing the user a cryptic action-id hash instead of an actionable
  // message.
  it('replaces a "Server Action ... was not found on the server" error with an actionable message', () => {
    const e = new Error('Server Action "40eb382bfee2b7bd9ba985b08a8cc5790018b2a3" was not found on the server. This request might be from an older or newer deployment.')
    expect(describeActionDispatchError(e)).toContain('rouvrez complètement')
  })

  it('replaces a "Failed to find Server Action" error with an actionable message', () => {
    const e = new Error('Failed to find Server Action "abc123". This request might be from an older or newer deployment.')
    expect(describeActionDispatchError(e)).toContain('rouvrez complètement')
  })
})
