import { NextRequest, NextResponse } from 'next/server'
import { IntervalsService, type ManualActivityInput } from '@/lib/intervals-api'

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

/**
 * Crée une activité RÉALISÉE manuelle sur Intervals.icu (pas une séance
 * planifiée — voir /api/intervals/events pour ça) — retour utilisateur :
 * "seras t il possible d'exporter la séance de muscu vers... intervals".
 * Deuxième verbe HTTP sur cette même route (GET reste la lecture
 * d'activités ci-dessus) — coexiste avec activities/[id]/route.ts (GET par
 * id), chemin distinct dans Next.js App Router, pas de conflit.
 */
export async function POST(request: NextRequest) {
  const athleteId = request.headers.get('x-intervals-athlete-id')
  const apiKey = request.headers.get('x-intervals-api-key')

  if (!athleteId || !apiKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 401 })
  }

  let activity: ManualActivityInput
  try {
    activity = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!activity.name || !activity.type || !activity.startDateLocal || !activity.description) {
    return NextResponse.json({ error: 'Missing required activity fields' }, { status: 400 })
  }

  try {
    const service = new IntervalsService(athleteId, apiKey)
    const result = await service.createManualActivity(activity)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
