import { NextRequest, NextResponse } from 'next/server';
import { createStravaActivity, type ManualStravaActivityInput } from '@/lib/strava-api';

/**
 * Crée une activité manuelle (musculation) sur Strava — voir
 * `ManualStravaActivityInput`. Même en-tête `x-strava-access-token` porté
 * par le client, même convention que les routes proxy `/api/intervals/*`
 * (`x-intervals-athlete-id`/`x-intervals-api-key`) : le jeton vit côté
 * client (Firestore, `settings/strava` — voir use-strava.ts), jamais côté
 * serveur.
 */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('x-strava-access-token');
  if (!accessToken) {
    return NextResponse.json({ error: 'Jeton Strava manquant.' }, { status: 401 });
  }
  let activity: ManualStravaActivityInput;
  try {
    activity = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }
  if (!activity.name || !activity.startDateLocal || activity.durationSeconds == null) {
    return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
  }
  try {
    const result = await createStravaActivity(accessToken, activity);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
