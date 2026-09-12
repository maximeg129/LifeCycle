import { describe, it, expect } from 'vitest'
import { buildStravaActivityBody } from './strava-api'

describe('buildStravaActivityBody', () => {
  it('maps a strength session into Strava\'s activity-create shape', () => {
    const body = buildStravaActivityBody({
      name: 'Force bas du corps',
      startDateLocal: '2026-09-12',
      description: 'Squat: 4x5 @ 80kg',
      durationSeconds: 2700,
    })
    expect(body).toEqual({
      name: 'Force bas du corps',
      sport_type: 'WeightTraining',
      start_date_local: '2026-09-12T12:00:00Z',
      elapsed_time: 2700,
      description: 'Squat: 4x5 @ 80kg',
    })
  })

  it('always uses the WeightTraining sport type — this integration never publishes cycling rides', () => {
    const body = buildStravaActivityBody({ name: 'x', startDateLocal: '2026-01-01', description: '', durationSeconds: 60 })
    expect(body.sport_type).toBe('WeightTraining')
  })
})
