import { describe, it, expect } from 'vitest'
import { parseStructuredWorkoutProfile, averageIntensityPct, zoneForPct, completedRideZone, workoutProfileBars } from './plan-calendar-types'

const EXAMPLE_SCRIPT = `Échauffement
- 15m ramp 55-65%

Corps de séance 4x
- 5m 95-105%
- 3m 50%

Retour au calme
- 10m 55%`

describe('parseStructuredWorkoutProfile', () => {
  it('parses the reference example from STRUCTURED_WORKOUT_SYNTAX', () => {
    const steps = parseStructuredWorkoutProfile(EXAMPLE_SCRIPT)
    // Échauffement (1) + Corps de séance 4x (2 steps × 4 = 8) + Retour au calme (1) = 10
    expect(steps).toHaveLength(10)
  })

  it('expands a repeated section per its "Nx" suffix', () => {
    const steps = parseStructuredWorkoutProfile(EXAMPLE_SCRIPT)
    const repeated = steps.filter((s) => s.durationSeconds === 300 && s.pctFtp === 100)
    expect(repeated).toHaveLength(4)
  })

  it('takes the midpoint of a ramp/range target', () => {
    const steps = parseStructuredWorkoutProfile(EXAMPLE_SCRIPT)
    expect(steps[0]).toEqual({ durationSeconds: 900, pctFtp: 60 })
  })

  it('handles a single-value target (no range)', () => {
    const steps = parseStructuredWorkoutProfile('Retour au calme\n- 10m 55%')
    expect(steps).toEqual([{ durationSeconds: 600, pctFtp: 55 }])
  })

  it('converts hours and seconds correctly', () => {
    const steps = parseStructuredWorkoutProfile('Section\n- 1h 60%\n- 30s 150%')
    expect(steps).toEqual([{ durationSeconds: 3600, pctFtp: 60 }, { durationSeconds: 30, pctFtp: 150 }])
  })

  it('skips a step line it cannot parse (e.g. an absolute-watts target) rather than throwing', () => {
    const steps = parseStructuredWorkoutProfile('Section\n- 5m 250w\n- 5m 100%')
    expect(steps).toEqual([{ durationSeconds: 300, pctFtp: 100 }])
  })

  it('returns an empty array for missing/empty input', () => {
    expect(parseStructuredWorkoutProfile(undefined)).toEqual([])
    expect(parseStructuredWorkoutProfile(null)).toEqual([])
    expect(parseStructuredWorkoutProfile('')).toEqual([])
  })

  it('ignores a section with no valid step lines', () => {
    expect(parseStructuredWorkoutProfile('Notes\nJuste du texte libre, pas une étape.')).toEqual([])
  })
})

describe('averageIntensityPct', () => {
  it('computes a duration-weighted average', () => {
    // 10m@50% + 5m@100% -> (600*50 + 300*100) / 900 = 66.67
    const avg = averageIntensityPct([{ durationSeconds: 600, pctFtp: 50 }, { durationSeconds: 300, pctFtp: 100 }])
    expect(avg).toBeCloseTo(66.67, 1)
  })

  it('returns null for an empty list rather than 0', () => {
    expect(averageIntensityPct([])).toBeNull()
  })
})

describe('zoneForPct', () => {
  it('classifies recovery intensity', () => {
    expect(zoneForPct(40).label).toBe('Récupération')
  })

  it('classifies endurance intensity', () => {
    expect(zoneForPct(65).label).toBe('Endurance')
  })

  it('classifies threshold intensity at the exact lower bound', () => {
    expect(zoneForPct(90).label).toBe('Seuil')
  })

  it('classifies the boundary between Seuil and VO2max correctly (maxPct exclusive)', () => {
    expect(zoneForPct(104).label).toBe('Seuil')
    expect(zoneForPct(105).label).toBe('VO2max')
  })

  it('falls back to the top zone for an extreme value', () => {
    expect(zoneForPct(300).label).toBe('Neuromusculaire')
  })

  it('gives every zone a real color, never an empty string', () => {
    for (const pct of [10, 60, 80, 95, 110, 130, 200]) {
      expect(zoneForPct(pct).color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('completedRideZone', () => {
  it('prefers icu_intensity when present', () => {
    const zone = completedRideZone({ icu_intensity: 0.85 }, 250)
    expect(zone?.label).toBe('Tempo')
  })

  it('falls back to bestAverageWatts/ftp when icu_intensity is absent', () => {
    const zone = completedRideZone({ icu_average_watts: 225 }, 250)
    // 225/250 = 90% -> Seuil
    expect(zone?.label).toBe('Seuil')
  })

  it('returns null when neither icu_intensity nor a computable watts/ftp ratio is available', () => {
    expect(completedRideZone({}, 250)).toBeNull()
    expect(completedRideZone({ icu_average_watts: 200 }, null)).toBeNull()
  })
})

describe('workoutProfileBars', () => {
  it('returns [] for an empty step list', () => {
    expect(workoutProfileBars([])).toEqual([])
  })

  it('sizes bar width by share of total duration', () => {
    // 600s + 300s = 900s total -> 66.67% / 33.33%
    const bars = workoutProfileBars([{ durationSeconds: 600, pctFtp: 50 }, { durationSeconds: 300, pctFtp: 100 }])
    expect(bars[0].widthPct).toBeCloseTo(66.67, 1)
    expect(bars[1].widthPct).toBeCloseTo(33.33, 1)
  })

  it('sizes bar height relative to the session peak, not an absolute %FTP scale', () => {
    // peak = 100 -> heights 50% and 100%, regardless of how "hard" 100% is in absolute terms
    const bars = workoutProfileBars([{ durationSeconds: 300, pctFtp: 50 }, { durationSeconds: 300, pctFtp: 100 }])
    expect(bars[0].heightPct).toBeCloseTo(50, 1)
    expect(bars[1].heightPct).toBeCloseTo(100, 1)
  })

  it('floors height at 4% so a low-intensity recovery step stays visible', () => {
    const bars = workoutProfileBars([{ durationSeconds: 300, pctFtp: 1 }, { durationSeconds: 300, pctFtp: 100 }])
    expect(bars[0].heightPct).toBe(4)
  })

  it('gives every bar a real color', () => {
    const bars = workoutProfileBars([{ durationSeconds: 300, pctFtp: 60 }])
    expect(bars[0].color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns [] rather than dividing by zero when total duration is 0', () => {
    expect(workoutProfileBars([{ durationSeconds: 0, pctFtp: 100 }])).toEqual([])
  })
})
