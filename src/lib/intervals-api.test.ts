import { describe, it, expect, vi, afterEach } from 'vitest'
import { IntervalsService } from './intervals-api'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
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
