import { describe, it, expect, vi, afterEach } from 'vitest'
import { IntervalsService, bestAverageWatts, bestRpe, feelToScore } from './intervals-api'

function jsonResponse(body: unknown, ok = true, status = 200, url = '') {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    url,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IntervalsService.getAthlete', () => {
  it('picks the cycling FTP from sportSettings and computes TSB from wellness', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/wellness/')) {
        return jsonResponse({ id: '2026-03-24', ctl: 80, atl: 50, ctlLoad: 5.2 })
      }
      return jsonResponse({
        id: 'i12345',
        firstname: 'Max',
        lastname: 'G',
        icu_weight: 72,
        weight: null,
        sportSettings: [
          { types: ['Run'], ftp: 0 },
          { types: ['Ride', 'VirtualRide'], ftp: 280 },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i12345', 'secret')
    const athlete = await service.getAthlete()

    expect(athlete.ftp).toBe(280)
    expect(athlete.weight).toBe(72) // prefers icu_weight over weight
    expect(athlete.ctl).toBe(80)
    expect(athlete.atl).toBe(50)
    expect(athlete.tsb).toBe(30)
    expect(athlete.name).toBe('Max G')
  })

  it('falls back to the first sport when no cycling entry matches', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/wellness/')) return jsonResponse(null, false, 404)
      return jsonResponse({
        id: 'i1',
        sportSettings: [{ types: ['Swim'], ftp: 150 }],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'secret')
    const athlete = await service.getAthlete()

    expect(athlete.ftp).toBe(150)
    expect(athlete.tsb).toBeUndefined() // wellness fetch failed -> no ctl/atl
  })

  it('sends the API key as HTTP Basic auth', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => jsonResponse({ id: 'i1' }))
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'my-secret-key')
    await service.getAthlete()

    const [, options] = fetchMock.mock.calls[0]
    const expected = 'Basic ' + btoa('API_KEY:my-secret-key')
    expect(options?.headers).toMatchObject({ Authorization: expected })
  })

  it('throws with the status code when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(null, false, 401)))
    const service = new IntervalsService('i1', 'bad-key')
    await expect(service.getActivities('2026-01-01')).rejects.toThrow(/401/)
  })

  // Regression: the error used to drop the response body entirely
  // ("Error {status}: {statusText}"), which meant a 4xx never said *why* —
  // exactly what cost two guess-and-check round trips diagnosing the
  // ride-analysis 404 and 422 in production instead of one look at the
  // API's own error text.
  it('includes the response body in the thrown error, not just the status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'must not be null: types' }, false, 422, 'https://intervals.icu/api/v1/activity/act1/streams.json')))
    const service = new IntervalsService('i1', 'k')
    await expect(service.getActivities('2026-01-01')).rejects.toThrow(/must not be null: types/)
  })
})

describe('IntervalsService.getActivities', () => {
  it('requests an explicit fields list including the icu_-prefixed power fields', async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'k')
    await service.getActivities('2026-01-01', '2026-01-31')

    const [url] = fetchMock.mock.calls[0]
    const params = new URL(url).searchParams
    expect(params.get('oldest')).toBe('2026-01-01')
    expect(params.get('newest')).toBe('2026-01-31')
    const fields = params.get('fields')?.split(',') ?? []
    expect(fields).toEqual(expect.arrayContaining(['icu_average_watts', 'icu_weighted_avg_watts', 'average_watts', 'weighted_average_watts', 'average_heartrate']))
  })
})

describe('bestAverageWatts', () => {
  it('prefers icu_weighted_avg_watts over every other field', () => {
    expect(bestAverageWatts({
      icu_weighted_avg_watts: 210,
      weighted_average_watts: 200,
      icu_average_watts: 190,
      average_watts: 180,
    })).toBe(210)
  })
  it('falls back down the chain when preferred fields are absent', () => {
    expect(bestAverageWatts({ icu_average_watts: 190, average_watts: 180 })).toBe(190)
    expect(bestAverageWatts({ average_watts: 180 })).toBe(180)
  })
  it('is null when no power field is present or positive', () => {
    expect(bestAverageWatts({})).toBeNull()
    expect(bestAverageWatts({ average_watts: 0 })).toBeNull()
    expect(bestAverageWatts({ average_watts: null })).toBeNull()
  })
})

describe('bestRpe', () => {
  it('prefers icu_rpe over the Strava-mirrored perceived_exertion', () => {
    expect(bestRpe({ icu_rpe: 7, perceived_exertion: 6 })).toBe(7)
  })
  it('falls back to perceived_exertion when icu_rpe is absent', () => {
    expect(bestRpe({ perceived_exertion: 6 })).toBe(6)
  })
  it('is null when neither field is present', () => {
    expect(bestRpe({})).toBeNull()
  })
})

describe('feelToScore', () => {
  it('maps the 1-5 Intervals.icu feel rating onto -1..1, ascending is better', () => {
    expect(feelToScore({ feel: 1 })).toBe(-1)
    expect(feelToScore({ feel: 3 })).toBe(0)
    expect(feelToScore({ feel: 5 })).toBe(1)
  })
  it('is null when there is no feel rating', () => {
    expect(feelToScore({})).toBeNull()
    expect(feelToScore({ feel: null })).toBeNull()
  })
})

describe('IntervalsService.getActivity / getActivityStreams', () => {
  // Regression test for a real 404 hit in production: getActivity() and
  // getActivityStreams() originally went through fetchIntervals(), which
  // prepends /athlete/{athleteId} to every path — correct for the
  // athlete-scoped list endpoint, but Intervals.icu addresses a single
  // activity (and its streams) by its own globally-unique id at a
  // top-level /activity/{id} path, not nested under /athlete/{id}/
  // activities/{id}. This went unnoticed because both methods were unused
  // anywhere in the app until the ride-analysis feature.
  it('requests the single activity from the top-level /activity/{id} path, not /athlete/{athleteId}/activities/{id}', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => jsonResponse({ id: 'act1' }))
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'k')
    await service.getActivity('act1')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://intervals.icu/api/v1/activity/act1')
  })

  it('requests activity streams from the top-level /activity/{id}/streams.json path with a comma-joined types param', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'k')
    await service.getActivityStreams('act1', ['watts', 'heartrate'])

    const [url] = fetchMock.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://intervals.icu/api/v1/activity/act1/streams.json')
    expect(parsed.searchParams.get('types')).toBe('watts,heartrate')
  })

  it('still sends the API key as HTTP Basic auth on the top-level path', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => jsonResponse({ id: 'act1' }))
    vi.stubGlobal('fetch', fetchMock)

    const service = new IntervalsService('i1', 'my-secret-key')
    await service.getActivity('act1')

    const [, options] = fetchMock.mock.calls[0]
    const expected = 'Basic ' + btoa('API_KEY:my-secret-key')
    expect(options?.headers).toMatchObject({ Authorization: expected })
  })
})

describe('IntervalsService.getFitnessChart', () => {
  it('computes tsb as ctl - atl and drops entries with neither', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      { id: '2026-03-01', ctl: 60, atl: 40, ctlLoad: 4 },
      { id: '2026-03-02' }, // no ctl/atl -> dropped
      { id: '2026-03-03', ctl: 65 }, // atl missing -> treated as 0
    ])))

    const service = new IntervalsService('i1', 'k')
    const chart = await service.getFitnessChart('2026-03-01', '2026-03-03')

    expect(chart).toHaveLength(2)
    expect(chart[0]).toEqual({ date: '2026-03-01', ctl: 60, atl: 40, tsb: 20, trainingLoad: 4 })
    expect(chart[1]).toEqual({ date: '2026-03-03', ctl: 65, atl: 0, tsb: 65, trainingLoad: 0 })
  })
})
