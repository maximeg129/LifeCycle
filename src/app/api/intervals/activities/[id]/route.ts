import { NextRequest, NextResponse } from 'next/server'
import { IntervalsService } from '@/lib/intervals-api'

/**
 * Single-activity detail + streams (watts/HR/cadence) — powers "Analyse
 * complète de la sortie" (rides-journal-tab.tsx / use-ride-analysis.ts).
 * getActivity()/getActivityStreams() already existed on IntervalsService
 * but were unused anywhere in the app until this route.
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

  // getActivity() failing is fatal — without it there's nothing to analyze.
  let activity
  try {
    activity = await service.getActivity(id)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `getActivity: ${message}` }, { status: 502 })
  }

  // getActivityStreams() failing is NOT fatal — confirmed in production
  // that Intervals.icu itself can fail to pull second-by-second data for a
  // Strava-synced activity ("Cannot read Strava activity API", a limit on
  // their end, not this route's request shape — the request format below
  // is otherwise confirmed correct). The activity-level summary already
  // fetched above (avg power/HR, distance, load, RPE...) is still a
  // perfectly good basis for an analysis, just without the zone/pacing
  // detail — so this degrades to `streams: null` instead of failing the
  // whole request, and use-ride-analysis.ts tells the user why in a
  // non-alarming way rather than surfacing this as an error.
  let streams = null
  let streamsError: string | null = null
  try {
    streams = await service.getActivityStreams(id, ['watts', 'heartrate', 'cadence'])
  } catch (e) {
    streamsError = e instanceof Error ? e.message : 'Unknown error'
    console.error('[api/intervals/activities/[id]] getActivityStreams failed, degrading to activity-only:', streamsError)
  }

  return NextResponse.json({ activity, streams, streamsError })
}
