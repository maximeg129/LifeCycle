import { NextRequest, NextResponse } from 'next/server'
import { IntervalsService } from '@/lib/intervals-api'

/**
 * Single-activity detail + streams (watts/HR/cadence/altitude) — powers
 * "Analyse complète de la sortie" (rides-journal-tab.tsx / use-ride-
 * analysis.ts). getActivity()/getActivityStreams() already existed on
 * IntervalsService but were unused anywhere in the app until this route.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const athleteId = request.headers.get('x-intervals-athlete-id')
  const apiKey = request.headers.get('x-intervals-api-key')

  if (!athleteId || !apiKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Missing activity id' }, { status: 400 })
  }

  const service = new IntervalsService(athleteId, apiKey)

  // Two independent try/catches (not Promise.all) so a failure says which
  // of the two calls it came from — a generic "Intervals.icu API Error
  // 422" gave no way to tell getActivity() and getActivityStreams() apart,
  // which cost real back-and-forth diagnosing the 404 and 422 this route
  // hit in production before either was fixed. Only the streams this
  // route's caller actually consumes are requested (see use-ride-
  // analysis.ts) — 'altitude'/'time' were being fetched unused, and one
  // fewer stream-type token is one fewer thing that can be rejected.
  let activity
  try {
    activity = await service.getActivity(id)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `getActivity: ${message}` }, { status: 502 })
  }

  let streams
  try {
    streams = await service.getActivityStreams(id, ['watts', 'heartrate', 'cadence'])
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `getActivityStreams: ${message}` }, { status: 502 })
  }

  return NextResponse.json({ activity, streams })
}
