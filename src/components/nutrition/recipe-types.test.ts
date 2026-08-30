import { describe, it, expect } from 'vitest'
import { parseIngredientsText, ingredientsToText, parseInstructionSteps } from './recipe-types'

describe('parseIngredientsText', () => {
  it('splits on newlines and trims each line', () => {
    expect(parseIngredientsText('250g Pommes de terre\n100g Champignons de Paris\n3 Œufs')).toEqual([
      '250g Pommes de terre',
      '100g Champignons de Paris',
      '3 Œufs',
    ])
  })

  it('drops blank lines', () => {
    expect(parseIngredientsText('250g Pommes de terre\n\n\n100g Champignons')).toEqual([
      '250g Pommes de terre',
      '100g Champignons',
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(parseIngredientsText('')).toEqual([])
    expect(parseIngredientsText('   \n  ')).toEqual([])
  })
})

describe('ingredientsToText', () => {
  it('joins with newlines', () => {
    expect(ingredientsToText(['250g Pommes de terre', '100g Champignons'])).toBe('250g Pommes de terre\n100g Champignons')
  })

  it('handles undefined/empty gracefully', () => {
    expect(ingredientsToText(undefined)).toBe('')
    expect(ingredientsToText([])).toBe('')
  })

  it('round-trips with parseIngredientsText', () => {
    const original = ['250g Pommes de terre', '100g Champignons de Paris']
    expect(parseIngredientsText(ingredientsToText(original))).toEqual(original)
  })
})

describe('parseInstructionSteps', () => {
  it('returns an empty array for empty input', () => {
    expect(parseInstructionSteps('')).toEqual([])
    expect(parseInstructionSteps('   ')).toEqual([])
  })

  it('splits one step per line, the common case', () => {
    expect(parseInstructionSteps('Couper les pommes de terre en dés.\nFaire revenir les champignons.\nBattre les œufs et assembler.')).toEqual([
      'Couper les pommes de terre en dés.',
      'Faire revenir les champignons.',
      'Battre les œufs et assembler.',
    ])
  })

  it('strips existing leading numbering from each line', () => {
    expect(parseInstructionSteps('1. Couper les pommes de terre.\n2) Faire revenir.\n3 - Assembler.')).toEqual([
      'Couper les pommes de terre.',
      'Faire revenir.',
      'Assembler.',
    ])
  })

  it('splits a single-line block on inline numbering', () => {
    expect(parseInstructionSteps('1. Couper les légumes. 2. Faire revenir. 3. Assembler et servir.')).toEqual([
      'Couper les légumes.',
      'Faire revenir.',
      'Assembler et servir.',
    ])
  })

  it('treats an unnumbered single-line block as one step', () => {
    expect(parseInstructionSteps('Tout mélanger et enfourner 20 minutes.')).toEqual(['Tout mélanger et enfourner 20 minutes.'])
  })
})
