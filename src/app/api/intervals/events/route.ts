import { NextRequest, NextResponse } from 'next/server'
import { IntervalsService, type PlannedWorkoutEvent } from '@/lib/intervals-api'

/**
 * Pushes a single planned workout onto the athlete's Intervals.icu
 * calendar. The only *write* proxy route in this folder (the others are
 * all reads) — see createPlannedWorkout() for the upsert-by-externalId
 * behaviour that makes re-sending an edited proposal safe.
 */
export async function POST(request: NextRequest) {
  const athleteId = request.headers.get('x-intervals-athlete-id')
  const apiKey = request.headers.get('x-intervals-api-key')

  if (!athleteId || !apiKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 401 })
  }

  let event: PlannedWorkoutEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!event.externalId || !event.name || !event.sportType || !event.startDateLocal || !event.description) {
    return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 })
  }

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const result = await service.createPlannedWorkout(event)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
