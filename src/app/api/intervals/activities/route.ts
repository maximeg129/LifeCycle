import { NextRequest, NextResponse } from 'next/server'
import { IntervalsService } from '@/lib/intervals-api'

export async function GET(request: NextRequest) {
  const athleteId = request.headers.get('x-intervals-athlete-id')
  const apiKey = request.headers.get('x-intervals-api-key')

  if (!athleteId || !apiKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const oldest = searchParams.get('oldest')
  const newest = searchParams.get('newest')
  // Used only by the gear-km reconciliation fetch — see getActivitiesRaw().
  const raw = searchParams.get('raw') === '1'

  if (!oldest) {
    return NextResponse.json({ error: 'Missing oldest parameter' }, { status: 400 })
  }

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const data = raw
      ? await service.getActivitiesRaw(oldest, newest ?? undefined)
      : await service.getActivities(oldest, newest ?? undefined)
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
