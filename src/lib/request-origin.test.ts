import { describe, it, expect } from 'vitest'
import { resolvePublicOrigin, type HeaderLike } from './request-origin'

function headersFrom(values: Record<string, string>): HeaderLike {
  return { get: (name) => values[name.toLowerCase()] ?? null }
}

describe('resolvePublicOrigin', () => {
  it('builds the origin from x-forwarded-host/x-forwarded-proto when present', () => {
    const headers = headersFrom({ 'x-forwarded-host': 'my-app.hosted.app', 'x-forwarded-proto': 'https' })
    expect(resolvePublicOrigin(headers, 'https://0.0.0.0:8080')).toBe('https://my-app.hosted.app')
  })

  it('defaults x-forwarded-proto to https when absent', () => {
    const headers = headersFrom({ 'x-forwarded-host': 'my-app.hosted.app' })
    expect(resolvePublicOrigin(headers, 'https://0.0.0.0:8080')).toBe('https://my-app.hosted.app')
  })

  it('falls back to the given origin when x-forwarded-host is absent (local dev, no proxy)', () => {
    const headers = headersFrom({})
    expect(resolvePublicOrigin(headers, 'http://localhost:9002')).toBe('http://localhost:9002')
  })

  it('respects a non-https forwarded proto', () => {
    const headers = headersFrom({ 'x-forwarded-host': 'internal.example.com', 'x-forwarded-proto': 'http' })
    expect(resolvePublicOrigin(headers, 'https://0.0.0.0:8080')).toBe('http://internal.example.com')
  })
})
