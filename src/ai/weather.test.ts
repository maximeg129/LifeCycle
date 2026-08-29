import { describe, it, expect } from 'vitest'
import { degreesToCompass } from './weather'

describe('degreesToCompass', () => {
  it('maps the 8 cardinal/intercardinal bearings', () => {
    expect(degreesToCompass(0)).toBe('Nord')
    expect(degreesToCompass(45)).toBe('Nord-Est')
    expect(degreesToCompass(90)).toBe('Est')
    expect(degreesToCompass(135)).toBe('Sud-Est')
    expect(degreesToCompass(180)).toBe('Sud')
    expect(degreesToCompass(225)).toBe('Sud-Ouest')
    expect(degreesToCompass(270)).toBe('Ouest')
    expect(degreesToCompass(315)).toBe('Nord-Ouest')
  })

  it('wraps 360 back to Nord', () => {
    expect(degreesToCompass(360)).toBe('Nord')
  })

  it('rounds to the nearest bearing', () => {
    expect(degreesToCompass(20)).toBe('Nord') // closer to 0 than 45
    expect(degreesToCompass(30)).toBe('Nord-Est') // closer to 45 than 0
  })

  it('handles negative degrees', () => {
    expect(degreesToCompass(-45)).toBe('Nord-Ouest')
  })
})
