import { describe, it, expect } from 'vitest'
import { toFlowInventoryItem, buildOutfitDateTime, CLOTHING_TYPE_LABELS, type ClothingItem } from './clothing-types'

describe('toFlowInventoryItem', () => {
  const baseItem: ClothingItem = {
    userId: 'user-1',
    name: 'Maillot manches longues',
    type: 'jersey',
    temperatureRangeCelsius: '5-15',
    windproof: false,
    waterproof: false,
    layer: 'mid',
  }

  it('maps the clothing type to its French label', () => {
    const result = toFlowInventoryItem(baseItem)
    expect(result.type).toBe(CLOTHING_TYPE_LABELS.jersey)
  })

  it('carries over the other fields unchanged', () => {
    const result = toFlowInventoryItem(baseItem)
    expect(result).toEqual({
      name: 'Maillot manches longues',
      type: 'Maillot',
      temperatureRangeCelsius: '5-15',
      windproof: false,
      waterproof: false,
      layer: 'mid',
    })
  })

  it('falls back to the raw type value for an unrecognized type', () => {
    const item = { ...baseItem, type: 'exotic-type' as ClothingItem['type'] }
    const result = toFlowInventoryItem(item)
    expect(result.type).toBe('exotic-type')
  })
})

describe('buildOutfitDateTime', () => {
  it('combines the date and time into a yyyy-MM-ddTHH:mm:00 string', () => {
    expect(buildOutfitDateTime(new Date(2026, 7, 27), '09:00')).toBe('2026-08-27T09:00:00')
  })

  it('pads single-digit months and days in the date part', () => {
    expect(buildOutfitDateTime(new Date(2026, 0, 5), '14:30')).toBe('2026-01-05T14:30:00')
  })
})
