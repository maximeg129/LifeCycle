import { describe, it, expect } from 'vitest'
import {
  validateLibraryEntry,
  parseTagsText,
  tagsToText,
  buildLibraryContextBlock,
  isLibrarySourceType,
  type LibraryEntryLike,
} from './library-types'

describe('isLibrarySourceType', () => {
  it('accepts the four known types', () => {
    expect(isLibrarySourceType('etude')).toBe(true)
    expect(isLibrarySourceType('article')).toBe(true)
    expect(isLibrarySourceType('livre')).toBe(true)
    expect(isLibrarySourceType('note-coach')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isLibrarySourceType('podcast')).toBe(false)
    expect(isLibrarySourceType('')).toBe(false)
  })
})

describe('validateLibraryEntry', () => {
  it('requires a title', () => {
    const result = validateLibraryEntry({ title: '  ', summary: 'Un résumé.', sourceType: 'etude' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/titre/i)
  })

  it('requires a summary', () => {
    const result = validateLibraryEntry({ title: 'Un titre', summary: '   ', sourceType: 'etude' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/résumé/i)
  })

  it('rejects an unknown source type', () => {
    const result = validateLibraryEntry({ title: 'Un titre', summary: 'Un résumé.', sourceType: 'podcast' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/type/i)
  })

  it('accepts a valid entry', () => {
    expect(validateLibraryEntry({ title: 'Un titre', summary: 'Un résumé.', sourceType: 'article' })).toEqual({ ok: true })
  })
})

describe('parseTagsText', () => {
  it('splits, trims and lowercases comma-separated tags', () => {
    expect(parseTagsText('HRV,  Récupération ,endurance')).toEqual(['hrv', 'récupération', 'endurance'])
  })

  it('drops empty entries', () => {
    expect(parseTagsText('hrv,, ,récupération')).toEqual(['hrv', 'récupération'])
  })

  it('dedupes', () => {
    expect(parseTagsText('hrv, HRV, hrv')).toEqual(['hrv'])
  })

  it('returns an empty array for blank input', () => {
    expect(parseTagsText('')).toEqual([])
    expect(parseTagsText('   ')).toEqual([])
  })
})

describe('tagsToText', () => {
  it('joins tags with a comma-space', () => {
    expect(tagsToText(['hrv', 'récupération'])).toBe('hrv, récupération')
  })

  it('returns an empty string for no tags', () => {
    expect(tagsToText([])).toBe('')
  })
})

describe('buildLibraryContextBlock', () => {
  it('returns an empty string when there are no entries', () => {
    expect(buildLibraryContextBlock([])).toBe('')
  })

  it('includes the entry count, title, authors, type label and summary', () => {
    const entries: LibraryEntryLike[] = [
      { title: 'A systems model of training', authors: 'Banister et al.', sourceType: 'etude', summary: 'Modèle impulsion-réponse fitness/fatigue.' },
    ]
    const text = buildLibraryContextBlock(entries)
    expect(text).toContain('BASE DE CONNAISSANCES (1 source ajoutée')
    expect(text).toContain('"A systems model of training" (Banister et al.) — Étude scientifique : Modèle impulsion-réponse fitness/fatigue.')
  })

  it('pluralizes the count for multiple entries', () => {
    const entries: LibraryEntryLike[] = [
      { title: 'A', sourceType: 'article', summary: 'Résumé A' },
      { title: 'B', sourceType: 'livre', summary: 'Résumé B' },
    ]
    expect(buildLibraryContextBlock(entries)).toContain('BASE DE CONNAISSANCES (2 sources ajoutées')
  })

  it('omits the authors parenthetical when absent', () => {
    const entries: LibraryEntryLike[] = [{ title: 'Sans auteur', sourceType: 'note-coach', summary: 'Résumé.' }]
    expect(buildLibraryContextBlock(entries)).toContain('"Sans auteur" — Note de coach/entraîneur : Résumé.')
  })

  it('appends tags in brackets when present', () => {
    const entries: LibraryEntryLike[] = [{ title: 'T', sourceType: 'article', summary: 'R', tags: ['hrv', 'sommeil'] }]
    expect(buildLibraryContextBlock(entries)).toContain('[hrv, sommeil]')
  })

  it('truncates an overly long summary with an ellipsis', () => {
    const longSummary = 'x'.repeat(700)
    const entries: LibraryEntryLike[] = [{ title: 'T', sourceType: 'article', summary: longSummary }]
    const text = buildLibraryContextBlock(entries)
    expect(text).toContain('x'.repeat(600) + '…')
    expect(text).not.toContain('x'.repeat(601))
  })

  it('ends with an instruction not to invent sources', () => {
    const entries: LibraryEntryLike[] = [{ title: 'T', sourceType: 'article', summary: 'R' }]
    expect(buildLibraryContextBlock(entries)).toContain('ne les invente jamais')
  })
})
