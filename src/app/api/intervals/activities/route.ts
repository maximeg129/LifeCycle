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

  if (!oldest) {
    return NextResponse.json({ error: 'Missing oldest parameter' }, { status: 400 })
  }

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const list = await service.getActivities(oldest, newest ?? undefined)

    // Strava-synced activities return minimal data from the list endpoint.
    // Enrich with individual details to get Intervals-computed fields (TSS, power…).
    const needsEnrichment = list.some(a => a.moving_time == null && a.icu_training_load == null)
    if (!needsEnrichment) {
      return NextResponse.json(list)
    }

    const enriched = await Promise.all(
      list.map(a =>
        service.getActivity(a.id).catch(() => a)
      ),
    )
    return NextResponse.json(enriched)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
