import { describe, it, expect } from 'vitest'
import { degreesToCompass, isSevereWeather, SEVERE_WIND_THRESHOLD_KMH, type WeatherForecast } from './weather'

function forecast(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    temperatureCelsius: 15,
    windSpeedKmh: 10,
    windDirectionDeg: 0,
    conditions: 'Ciel dégagé',
    weatherCode: 0,
    ...overrides,
  }
}

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

describe('isSevereWeather', () => {
  it('is false for calm, dry conditions', () => {
    expect(isSevereWeather(forecast())).toBe(false)
  })

  it('is true at or above the wind threshold, regardless of conditions', () => {
    expect(isSevereWeather(forecast({ windSpeedKmh: SEVERE_WIND_THRESHOLD_KMH }))).toBe(true)
    expect(isSevereWeather(forecast({ windSpeedKmh: SEVERE_WIND_THRESHOLD_KMH + 5 }))).toBe(true)
  })

  it('is false just under the wind threshold', () => {
    expect(isSevereWeather(forecast({ windSpeedKmh: SEVERE_WIND_THRESHOLD_KMH - 1 }))).toBe(false)
  })

  it('is true for heavy rain, heavy snow, and any thunderstorm code', () => {
    for (const code of [65, 75, 82, 95, 96, 99]) {
      expect(isSevereWeather(forecast({ weatherCode: code })), `code ${code}`).toBe(true)
    }
  })

  it('is false for light/moderate rain or plain fog — inconvenient, not unrideable', () => {
    for (const code of [45, 51, 61, 63, 71, 80]) {
      expect(isSevereWeather(forecast({ weatherCode: code })), `code ${code}`).toBe(false)
    }
  })

  it('never treats the error fallback as severe — no real data to judge', () => {
    expect(isSevereWeather(forecast({ windSpeedKmh: 100, weatherCode: 99, error: 'geocoding failed' }))).toBe(false)
  })
})
