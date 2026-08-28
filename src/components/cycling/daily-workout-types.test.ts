import { describe, it, expect } from 'vitest'
import {
  clampAvailableMinutes,
  summarizeRecentSessions,
  dailyWorkoutExternalId,
  buildWorkoutEventPayload,
  type ActivityLike,
} from './daily-workout-types'

describe('clampAvailableMinutes', () => {
  it('passes through a value already in range', () => {
    expect(clampAvailableMinutes(90)).toBe(90)
  })

  it('rounds to the nearest whole minute', () => {
    expect(clampAvailableMinutes(45.6)).toBe(46)
  })

  it('floors to the minimum for a too-small value', () => {
    expect(clampAvailableMinutes(5)).toBe(15)
  })

  it('floors to the minimum for a negative value', () => {
    expect(clampAvailableMinutes(-30)).toBe(15)
  })

  it('caps at the maximum for a very large value', () => {
    expect(clampAvailableMinutes(600)).toBe(360)
  })

  it('falls back to the minimum for NaN', () => {
    expect(clampAvailableMinutes(NaN)).toBe(15)
  })

  it('falls back to the minimum for Infinity', () => {
    expect(clampAvailableMinutes(Infinity)).toBe(15)
  })
})

describe('summarizeRecentSessions', () => {
  const activities: ActivityLike[] = [
    { start_date_local: '2026-08-20T09:00:00', type: 'Ride', moving_time: 3600, icu_training_load: 55 },
    { start_date_local: '2026-08-25T09:00:00', type: 'Ride', moving_time: 5400, icu_training_load: 90 },
    { start_date_local: '2026-08-28T09:00:00', type: 'VirtualRide', moving_time: 1800, icu_training_load: 30 },
    // Outside the 7-day window ending 2026-08-28 (window starts 2026-08-21)
    { start_date_local: '2026-08-10T09:00:00', type: 'Ride', moving_time: 3600, icu_training_load: 60 },
    // Missing date — must be dropped rather than crash
    { start_date_local: null, type: 'Ride', moving_time: 1000, icu_training_load: 20 },
  ]

  it('keeps only sessions within the window and sorts oldest first', () => {
    const result = summarizeRecentSessions(activities, '2026-08-28', 7)
    expect(result.map((s) => s.date)).toEqual(['2026-08-25', '2026-08-28'])
  })

  it('converts moving_time seconds to whole minutes', () => {
    const result = summarizeRecentSessions(activities, '2026-08-28', 7)
    expect(result[0].durationMinutes).toBe(90)
    expect(result[1].durationMinutes).toBe(30)
  })

  it('carries over type and training load', () => {
    const result = summarizeRecentSessions(activities, '2026-08-28', 7)
    expect(result[1]).toMatchObject({ type: 'VirtualRide', trainingLoad: 30 })
  })

  it('returns an empty array when nothing falls in the window', () => {
    expect(summarizeRecentSessions(activities, '2026-01-01', 7)).toEqual([])
  })

  it('returns an empty array for an empty input', () => {
    expect(summarizeRecentSessions([], '2026-08-28', 7)).toEqual([])
  })
})

describe('dailyWorkoutExternalId', () => {
  it('is deterministic for a given date', () => {
    expect(dailyWorkoutExternalId('2026-08-28')).toBe('lifecycle-daily-2026-08-28')
    expect(dailyWorkoutExternalId('2026-08-28')).toBe(dailyWorkoutExternalId('2026-08-28'))
  })

  it('differs across dates', () => {
    expect(dailyWorkoutExternalId('2026-08-28')).not.toBe(dailyWorkoutExternalId('2026-08-29'))
  })
})

describe('buildWorkoutEventPayload', () => {
  const proposal = {
    title: 'Endurance 90min',
    sportType: 'Ride',
    durationMinutes: 90,
    structuredWorkout: '- 90m 60-70% Endurance',
  }

  it('maps the proposal fields onto the Intervals.icu event shape', () => {
    const event = buildWorkoutEventPayload(proposal, '2026-08-28')
    expect(event).toEqual({
      externalId: 'lifecycle-daily-2026-08-28',
      name: 'Endurance 90min',
      sportType: 'Ride',
      startDateLocal: '2026-08-28',
      description: '- 90m 60-70% Endurance',
      durationSeconds: 5400,
    })
  })

  it('falls back to Ride when sportType is empty', () => {
    const event = buildWorkoutEventPayload({ ...proposal, sportType: '' }, '2026-08-28')
    expect(event.sportType).toBe('Ride')
  })

  it('omits durationSeconds when durationMinutes is not positive', () => {
    const event = buildWorkoutEventPayload({ ...proposal, durationMinutes: 0 }, '2026-08-28')
    expect(event.durationSeconds).toBeUndefined()
  })

  it('uses the same externalId as dailyWorkoutExternalId for the same date, so re-sending upserts', () => {
    const event = buildWorkoutEventPayload(proposal, '2026-08-28')
    expect(event.externalId).toBe(dailyWorkoutExternalId('2026-08-28'))
  })
})
