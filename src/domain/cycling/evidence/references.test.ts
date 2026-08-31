import { describe, it, expect } from 'vitest'
import { REFERENCES } from './references'

const EXPECTED_IDS = Array.from({ length: 35 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`)

describe('REFERENCES', () => {
  it('contains exactly R01 through R35, no gaps and no extras', () => {
    expect(Object.keys(REFERENCES).sort()).toEqual(EXPECTED_IDS.sort())
  })

  it('keys every entry under its own id', () => {
    for (const [key, ref] of Object.entries(REFERENCES)) {
      expect(ref.id, `entry keyed "${key}" has id "${ref.id}"`).toBe(key)
    }
  })

  it('gives every entry a non-empty authors, title, source and claim', () => {
    for (const [id, ref] of Object.entries(REFERENCES)) {
      expect(ref.authors.trim(), `${id} authors`).not.toBe('')
      expect(ref.title.trim(), `${id} title`).not.toBe('')
      expect(ref.source.trim(), `${id} source`).not.toBe('')
      expect(ref.claim.trim(), `${id} claim`).not.toBe('')
    }
  })

  it('gives every entry a valid evidence level and a plausible year', () => {
    for (const [id, ref] of Object.entries(REFERENCES)) {
      expect(['A', 'B', 'C'], `${id} level`).toContain(ref.level)
      expect(ref.year, `${id} year`).toBeGreaterThan(1970)
      expect(ref.year, `${id} year`).toBeLessThanOrEqual(2026)
    }
  })

  it('only marks openAccess true where the source document says so explicitly (R02, R19, R34, R35)', () => {
    const openAccessIds = Object.entries(REFERENCES)
      .filter(([, ref]) => ref.openAccess)
      .map(([id]) => id)
      .sort()
    expect(openAccessIds).toEqual(['R02', 'R19', 'R34', 'R35'])
  })
})
