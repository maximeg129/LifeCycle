import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  getIsoWeekId,
  getWeekDays,
  dayNameToIndex,
  indexToDayName,
  normalizeMealType,
  normalizeMacros,
  parseMealPlanJson,
  formatIngredientLine,
} from './meal-plan-types'

describe('getWeekStart', () => {
  it('returns the same Monday for any day within that week', () => {
    const monday = getWeekStart(new Date(2026, 7, 24)) // Mon 24 Aug 2026
    expect(monday.getDate()).toBe(24)
    expect(getWeekStart(new Date(2026, 7, 26)).getDate()).toBe(24) // Wed
    expect(getWeekStart(new Date(2026, 7, 30)).getDate()).toBe(24) // Sun
  })
})

describe('getIsoWeekId', () => {
  it('matches known ISO-8601 reference weeks', () => {
    expect(getIsoWeekId(new Date(2026, 0, 1))).toBe('2026-W01') // Thu
    expect(getIsoWeekId(new Date(2025, 11, 29))).toBe('2026-W01') // Mon, belongs to next year's W01
    expect(getIsoWeekId(new Date(2020, 11, 31))).toBe('2020-W53') // 2020 has a W53
  })
})

describe('getWeekDays', () => {
  it('returns 7 consecutive dates starting at weekStart', () => {
    const days = getWeekDays(new Date(2026, 7, 24))
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.getDate())).toEqual([24, 25, 26, 27, 28, 29, 30])
  })
})

describe('dayNameToIndex / indexToDayName', () => {
  it('maps French day names case/accent-insensitively', () => {
    expect(dayNameToIndex('lundi')).toBe(0)
    expect(dayNameToIndex('Dimanche')).toBe(6)
    expect(dayNameToIndex('MERCREDI')).toBe(2)
    expect(dayNameToIndex('jeûdi')).toBe(3) // accent stripped -> jeudi
  })
  it('returns -1 for unknown names', () => {
    expect(dayNameToIndex('someday')).toBe(-1)
  })
  it('round-trips through indexToDayName', () => {
    expect(indexToDayName(0)).toBe('lundi')
    expect(indexToDayName(6)).toBe('dimanche')
    expect(indexToDayName(7)).toBe('lundi') // wraps
  })
})

describe('normalizeMealType', () => {
  it('recognizes common French and English spellings', () => {
    expect(normalizeMealType('petit-déjeuner')).toBe('breakfast')
    expect(normalizeMealType('Déjeuner')).toBe('lunch')
    expect(normalizeMealType('dîner')).toBe('dinner')
    expect(normalizeMealType('Collation')).toBe('snack')
    expect(normalizeMealType('lunch')).toBe('lunch')
  })
  it('returns null for unrecognized types', () => {
    expect(normalizeMealType('brunch')).toBeNull()
  })
})

describe('normalizeMacros', () => {
  it('accepts French keys', () => {
    expect(normalizeMacros({ calories: 620, proteines: 45, glucides: 55, lipides: 18 }))
      .toEqual({ calories: 620, protein: 45, carbs: 55, fat: 18 })
  })
  it('accepts English keys', () => {
    expect(normalizeMacros({ calories: 620, protein: 45, carbs: 55, fat: 18 }))
      .toEqual({ calories: 620, protein: 45, carbs: 55, fat: 18 })
  })
  it('defaults missing fields to 0', () => {
    expect(normalizeMacros({ calories: 620 })).toEqual({ calories: 620, protein: 0, carbs: 0, fat: 0 })
  })
  it('handles non-object input without throwing', () => {
    expect(normalizeMacros(undefined)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('formatIngredientLine', () => {
  it('formats quantity + unit + name as a single free-text line', () => {
    expect(formatIngredientLine({ name: 'Poulet', quantity: 150, unit: 'g' })).toBe('150g Poulet')
  })
  it('falls back to just the name when quantity/unit are missing', () => {
    expect(formatIngredientLine({ name: 'Sel', quantity: 0, unit: '' })).toBe('Sel')
  })
})

describe('parseMealPlanJson', () => {
  it('parses a well-formed weekly plan', () => {
    const json = JSON.stringify({
      semaine_du: '2026-08-24',
      repas: [
        {
          jour: 'lundi', type_repas: 'dejeuner', nom_recette: 'Poulet quinoa',
          ingredients: [{ nom: 'Poulet', quantite: 150, unite: 'g' }],
          macros: { calories: 620, proteines: 45, glucides: 55, lipides: 18 },
        },
      ],
    })
    const result = parseMealPlanJson(json)
    expect(result.errors).toEqual([])
    expect(result.meals).toHaveLength(1)
    expect(result.meals[0]).toMatchObject({
      dayIndex: 0,
      mealType: 'lunch',
      recipeName: 'Poulet quinoa',
      macros: { calories: 620, protein: 45, carbs: 55, fat: 18 },
    })
    expect(result.meals[0].ingredients).toEqual([{ name: 'Poulet', quantity: 150, unit: 'g' }])
  })

  it('accepts a bare array of repas without the semaine_du wrapper', () => {
    const json = JSON.stringify([
      { jour: 'mardi', type_repas: 'diner', nom_recette: 'Saumon', ingredients: [], macros: {} },
    ])
    const result = parseMealPlanJson(json)
    expect(result.meals).toHaveLength(1)
    expect(result.meals[0].dayIndex).toBe(1)
  })

  it('collects per-entry errors without losing the rest of the import', () => {
    const json = JSON.stringify({
      repas: [
        { jour: 'lundi', type_repas: 'dejeuner', nom_recette: 'OK', ingredients: [], macros: {} },
        { jour: 'blah', type_repas: 'dejeuner', nom_recette: 'Bad day', ingredients: [], macros: {} },
        { jour: 'mardi', type_repas: 'brunch', nom_recette: 'Bad type', ingredients: [], macros: {} },
      ],
    })
    const result = parseMealPlanJson(json)
    expect(result.meals).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
  })

  it('returns an error for invalid JSON rather than throwing', () => {
    const result = parseMealPlanJson('{not json')
    expect(result.meals).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns an error when there is no repas array at all', () => {
    const result = parseMealPlanJson(JSON.stringify({ foo: 'bar' }))
    expect(result.meals).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('links a repas entry to its fiche technique via `recette`, pulling ingredients/instructions/macros from there', () => {
    const json = JSON.stringify({
      recettes: [{
        titre: 'Poulet Quinoa Brocoli',
        ingredients: [{ nom: 'Poulet', quantite: 150, unite: 'g' }],
        instructions: 'Cuire le quinoa...',
        macros: { calories: 620, proteines: 45, glucides: 55, lipides: 18 },
      }],
      repas: [
        // different casing/whitespace than the recette title, and no inline ingredients/macros of its own
        { jour: 'lundi', type_repas: 'dejeuner', recette: ' poulet quinoa brocoli ' },
      ],
    })
    const result = parseMealPlanJson(json)
    expect(result.errors).toEqual([])
    expect(result.recipes).toHaveLength(1)
    expect(result.meals[0]).toMatchObject({
      recipeName: 'Poulet Quinoa Brocoli', // canonical casing from the recette, not the repas reference
      instructions: 'Cuire le quinoa...',
      macros: { calories: 620, protein: 45, carbs: 55, fat: 18 },
    })
    expect(result.meals[0].ingredients).toEqual([{ name: 'Poulet', quantity: 150, unit: 'g' }])
  })

  it('falls back to inline ingredients/macros when a repas has no matching recette', () => {
    const json = JSON.stringify({
      recettes: [{ titre: 'Autre chose', ingredients: [], macros: {} }],
      repas: [{
        jour: 'mardi', type_repas: 'diner', recette: 'Saumon patate douce',
        ingredients: [{ nom: 'Saumon', quantite: 120, unite: 'g' }],
        macros: { calories: 400, proteines: 30, glucides: 20, lipides: 15 },
      }],
    })
    const result = parseMealPlanJson(json)
    expect(result.meals[0].recipeName).toBe('Saumon patate douce')
    expect(result.meals[0].macros).toEqual({ calories: 400, protein: 30, carbs: 20, fat: 15 })
  })

  it('dedupes recettes by title within the same import', () => {
    const json = JSON.stringify({
      recettes: [
        { titre: 'Poulet', macros: { calories: 500 } },
        { titre: 'poulet', macros: { calories: 999 } }, // same title, different case -> last one wins, still one entry
      ],
      repas: [{ jour: 'lundi', type_repas: 'dejeuner', recette: 'Poulet' }],
    })
    const result = parseMealPlanJson(json)
    expect(result.recipes).toHaveLength(1)
  })
})
