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
})
