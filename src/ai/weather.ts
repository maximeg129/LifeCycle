// Real-weather fetch shared by the AI flows that need it — extracted from
// cycling-outfit-recommendation-flow.ts (the first flow to need real
// forecast data) so dailyWorkoutRecommendation can reuse the exact same
// geocoding/Open-Meteo logic rather than re-implementing it, when the
// athlete provides a ride location/time for wind-aware routing advice.
// No API key needed (Open-Meteo is free/keyless).

export interface WeatherForecast {
  temperatureCelsius: number
  windSpeedKmh: number
  /** Meteorological convention — the compass bearing the wind is blowing FROM (0=N, 90=E, 180=S, 270=W), not the direction it's heading toward. */
  windDirectionDeg: number
  conditions: string
  error?: string
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Ciel dégagé',
  1: 'Principalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
  61: 'Pluie faible', 63: 'Pluie modérée', 65: 'Pluie forte',
  71: 'Neige faible', 73: 'Neige modérée', 75: 'Neige forte',
  80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses violentes',
  95: 'Orage léger', 96: 'Orage avec grêle', 99: 'Orage violent',
}

/** Fetches the real weather forecast for a location and date/time via Open-Meteo. Never throws — returns a fallback with `error` set on any failure, so a caller can skip using the data rather than trusting placeholder numbers. */
export async function fetchWeatherForecast(location: string, dateTime: string): Promise<WeatherForecast> {
  try {
    let lat: number, lon: number

    // 1. Geocoding
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=fr&format=json`
    const geoRes = await fetch(geoUrl)
    const geoData = await geoRes.json()

    if (!geoData.results || geoData.results.length === 0) {
      // Fallback if coordinates are provided directly
      const coords = location.split(',').map((c: string) => parseFloat(c.trim()))
      if (coords.length === 2 && !isNaN(coords[0])) {
        [lat, lon] = coords
      } else {
        throw new Error('Location not found')
      }
    } else {
      lat = geoData.results[0].latitude
      lon = geoData.results[0].longitude
    }

    // 2. Weather Forecast
    const date = new Date(dateTime)
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m&forecast_days=14`
    const weatherRes = await fetch(forecastUrl)
    const weatherData = await weatherRes.json()

    // Find the closest hour
    const targetTime = date.toISOString().slice(0, 13) + ':00'
    const timeIndex = weatherData.hourly.time.findIndex((t: string) => t.startsWith(targetTime.slice(0, 13)))
    const safeIndex = timeIndex === -1 ? 0 : timeIndex

    return {
      temperatureCelsius: weatherData.hourly.temperature_2m[safeIndex],
      windSpeedKmh: weatherData.hourly.windspeed_10m[safeIndex],
      windDirectionDeg: weatherData.hourly.winddirection_10m[safeIndex],
      conditions: WEATHER_CODES[weatherData.hourly.weathercode[safeIndex]] || 'Conditions variables',
    }
  } catch (e) {
    return {
      temperatureCelsius: 15,
      windSpeedKmh: 10,
      windDirectionDeg: 0,
      conditions: 'Erreur lors de la récupération des données réelles',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

const COMPASS_LABELS = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest']

/** 8-point compass label (French) for a meteorological wind-direction bearing in degrees. */
export function degreesToCompass(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360
  const index = Math.round(normalized / 45) % 8
  return COMPASS_LABELS[index]
}
