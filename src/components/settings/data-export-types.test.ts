import { describe, it, expect } from 'vitest'
import { buildExportPayload, buildExportFilename, TOP_LEVEL_COLLECTIONS } from './data-export-types'

describe('buildExportPayload', () => {
  it('wraps the collected data with the uid and an ISO export timestamp', () => {
    const data = { recipes: [{ id: '1', title: 'Oatmeal' }], tasks: [] }
    const payload = buildExportPayload('user-123', data)
    expect(payload.uid).toBe('user-123')
    expect(payload.data).toBe(data)
    expect(() => new Date(payload.exportedAt).toISOString()).not.toThrow()
    expect(new Date(payload.exportedAt).toISOString()).toBe(payload.exportedAt)
  })

  it('preserves empty collections rather than dropping them', () => {
    const payload = buildExportPayload('user-123', { recipes: [] })
    expect(payload.data.recipes).toEqual([])
  })
})

describe('buildExportFilename', () => {
  it('formats the date as yyyy-MM-dd in the filename', () => {
    expect(buildExportFilename(new Date(2026, 7, 27))).toBe('lifecycle-export-2026-08-27.json')
  })

  it('pads single-digit months and days', () => {
    expect(buildExportFilename(new Date(2026, 0, 5))).toBe('lifecycle-export-2026-01-05.json')
  })
})

describe('TOP_LEVEL_COLLECTIONS', () => {
  it('is a non-empty list re-exported from the account-deletion sweep (single source of truth)', () => {
    expect(TOP_LEVEL_COLLECTIONS.length).toBeGreaterThan(0)
    expect(TOP_LEVEL_COLLECTIONS).toContain('recipes')
    expect(TOP_LEVEL_COLLECTIONS).toContain('tasks')
  })
})
