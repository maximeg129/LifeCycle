import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const athleteId = request.headers.get('x-intervals-athlete-id')
  const apiKey = request.headers.get('x-intervals-api-key')

  if (!athleteId || !apiKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 401 })
  }

  const baseUrl = `https://intervals.icu/api/v1/athlete/${athleteId}`
  const authHeader = 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const headers = { Authorization: authHeader }

  const today = new Date().toISOString().slice(0, 10)
  const oldest30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  // Same floor syncAll() uses for gear reconciliation — checking here
  // whether the API actually returns the full history for this range, or
  // silently truncates/paginates it, which would explain a delta of 0.
  const fullHistoryOldest = '2000-01-01'

  try {
    const [athleteRes, wellnessRes, activitiesRes, fullHistoryRes] = await Promise.all([
      fetch(baseUrl, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
      fetch(`${baseUrl}/wellness/${today}`, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
      fetch(`${baseUrl}/activities?oldest=${oldest30}&newest=${today}`, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
      fetch(`${baseUrl}/activities?oldest=${fullHistoryOldest}&newest=${today}&fields=id,gear_id,distance,start_date_local`, { headers })
        .then(async r => ({ _status: r.status, _ok: r.ok, _body: await r.json().catch(() => null) }))
        .catch(e => ({ _error: e.message })),
    ])

    // Per-gear distance sum from the full-history fetch — exactly what
    // syncAll() computes, so we can see directly whether it matches
    // reality or is truncated/empty.
    let gearTotals: Record<string, { activityCount: number; totalKm: number }> | null = null
    let dateRange: { earliest: string | null; latest: string | null } | null = null
    if (fullHistoryRes && typeof fullHistoryRes === 'object' && Array.isArray((fullHistoryRes as { _body?: unknown })._body)) {
      const list = (fullHistoryRes as { _body: Array<{ gear_id?: string; distance?: number; start_date_local?: string }> })._body
      gearTotals = {}
      let earliest: string | null = null
      let latest: string | null = null
      for (const a of list) {
        if (a.gear_id) {
          const entry = gearTotals[a.gear_id] ?? { activityCount: 0, totalKm: 0 }
          entry.activityCount++
          entry.totalKm += (a.distance ?? 0) / 1000
          gearTotals[a.gear_id] = entry
        }
        const d = a.start_date_local?.slice(0, 10)
        if (d && (!earliest || d < earliest)) earliest = d
        if (d && (!latest || d > latest)) latest = d
      }
      for (const g of Object.keys(gearTotals)) gearTotals[g].totalKm = Math.round(gearTotals[g].totalKm)
      dateRange = { earliest, latest }
    }

    return NextResponse.json({
      _debug: true,
      athlete: {
        _type: typeof athleteRes,
        _keys: athleteRes && typeof athleteRes === 'object' ? Object.keys(athleteRes) : null,
        _sample: athleteRes,
      },
      wellness: {
        _type: typeof wellnessRes,
        _keys: wellnessRes && typeof wellnessRes === 'object' ? Object.keys(wellnessRes) : null,
        _sample: wellnessRes,
      },
      activities: {
        _type: typeof activitiesRes,
        _isArray: Array.isArray(activitiesRes),
        _length: Array.isArray(activitiesRes) ? activitiesRes.length : null,
        _firstKeys: Array.isArray(activitiesRes) && activitiesRes.length > 0 ? Object.keys(activitiesRes[0]) : null,
        _first: Array.isArray(activitiesRes) && activitiesRes.length > 0 ? activitiesRes[0] : activitiesRes,
      },
      fullHistory: {
        _requestOldest: fullHistoryOldest,
        _httpStatus: (fullHistoryRes as { _status?: number })?._status ?? null,
        _length: Array.isArray((fullHistoryRes as { _body?: unknown })._body) ? (fullHistoryRes as { _body: unknown[] })._body.length : null,
        dateRangeReturned: dateRange,
        gearTotals,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
