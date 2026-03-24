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

  try {
    const [athleteRes, wellnessRes, activitiesRes] = await Promise.all([
      fetch(baseUrl, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
      fetch(`${baseUrl}/wellness/${today}`, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
      fetch(`${baseUrl}/activities?oldest=${oldest30}&newest=${today}`, { headers }).then(r => r.json()).catch(e => ({ _error: e.message })),
    ])

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
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
