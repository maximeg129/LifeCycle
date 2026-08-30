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

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const [activity, streams] = await Promise.all([
      service.getActivity(id),
      service.getActivityStreams(id, ['watts', 'heartrate', 'cadence', 'altitude', 'time']),
    ])
    return NextResponse.json({ activity, streams })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
