import { NextRequest, NextResponse } from 'next/server';
import { deauthorizeStrava } from '@/lib/strava-api';

/** Révoque l'accès Strava (déconnexion depuis Réglages) — voir use-strava.ts (disconnect). */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('x-strava-access-token');
  if (!accessToken) {
    return NextResponse.json({ error: 'Jeton Strava manquant.' }, { status: 401 });
  }
  try {
    await deauthorizeStrava(accessToken);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
