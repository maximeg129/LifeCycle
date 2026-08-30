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

  it('has no duplicate entries', () => {
    expect(new Set(TOP_LEVEL_COLLECTIONS).size).toBe(TOP_LEVEL_COLLECTIONS.length)
  })

  // Regression guard — an earlier version of this list had silently drifted
  // out of step with firestore.rules (see account-deletion.ts's comment):
  // roughly half of the app's real top-level collections were missing, so
  // account deletion left that data behind instead of erasing it, and the
  // personal data export omitted it too. Every collection with its own
  // `match /name/{id}` directly under `/users/{userId}/` in firestore.rules
  // must be listed here.
  it('covers every top-level collection defined in firestore.rules', () => {
    const expected = [
      'settings', 'coachMemory', 'activities', 'trainingPlans', 'bikes', 'components',
      'chains', 'coachInjuries', 'coachGoals', 'sessionFeedback', 'workoutProposals',
      'rideAnalyses', 'coachChatMessages', 'maintenanceRecords', 'recipes', 'tags',
      'ingredients', 'cyclingClothingItems', 'plants', 'pantryItems', 'shoppingListItems',
      'mealPlans', 'mealLogs', 'hydrationLogs', 'expenseCategories', 'monthlyBudgets',
      'expenses', 'tasks', 'healthMetrics', 'healthGoals',
    ]
    for (const name of expected) {
      expect(TOP_LEVEL_COLLECTIONS, `missing '${name}'`).toContain(name)
    }
    expect(TOP_LEVEL_COLLECTIONS.length).toBe(expected.length)
  })
})
