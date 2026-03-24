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

  if (!oldest || !newest) {
    return NextResponse.json({ error: 'Missing oldest/newest parameters' }, { status: 400 })
  }

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const data = await service.getFitnessChart(oldest, newest)
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
