import { describe, it, expect } from 'vitest'
import { SUPPLEMENTARY_SOURCES } from './supplementary-sources'
import { REFERENCES } from './references'

describe('SUPPLEMENTARY_SOURCES', () => {
  it('keys every entry under its own id, prefixed S (never R — never confused with the original 35)', () => {
    for (const [key, source] of Object.entries(SUPPLEMENTARY_SOURCES)) {
      expect(source.id, `entry keyed "${key}"`).toBe(key)
      expect(source.id.startsWith('S'), `"${source.id}" should start with S, not R`).toBe(true)
    }
  })

  it('never reuses an id already present in the original 35 references', () => {
    const referenceIds = new Set(Object.keys(REFERENCES))
    for (const id of Object.keys(SUPPLEMENTARY_SOURCES)) {
      expect(referenceIds.has(id), `"${id}" collides with an R01-R35 reference id`).toBe(false)
    }
  })

  it('gives every entry a non-empty title, attribution, addedFor and claim', () => {
    for (const [id, source] of Object.entries(SUPPLEMENTARY_SOURCES)) {
      expect(source.title.trim(), `${id} title`).not.toBe('')
      expect(source.attribution.trim(), `${id} attribution`).not.toBe('')
      expect(source.addedFor.trim(), `${id} addedFor`).not.toBe('')
      expect(source.claim.trim(), `${id} claim`).not.toBe('')
    }
  })

  it('documents the known internal discrepancy on S02 and how it was resolved', () => {
    expect(SUPPLEMENTARY_SOURCES.S02.knownDiscrepancy).toBeDefined()
    expect(SUPPLEMENTARY_SOURCES.S02.knownDiscrepancy).toMatch(/50.*79|60.*80/)
  })
})
