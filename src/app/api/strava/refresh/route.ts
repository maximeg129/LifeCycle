import { NextRequest, NextResponse } from 'next/server';
import { refreshStravaToken } from '@/lib/strava-api';

/**
 * Rafraîchit un access_token Strava expiré/proche d'expirer — le
 * refresh_token ne peut pas être échangé directement depuis le navigateur
 * (nécessite STRAVA_CLIENT_SECRET, jamais exposé côté client), d'où ce
 * proxy. Voir use-strava.ts (getValidAccessToken) pour l'appelant.
 */
export async function POST(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET non configurés côté serveur.' }, { status: 500 });
  }
  const body = await request.json().catch(() => null) as { refreshToken?: string } | null;
  if (!body?.refreshToken) {
    return NextResponse.json({ error: 'refreshToken manquant.' }, { status: 400 });
  }
  try {
    const tokens = await refreshStravaToken(body.refreshToken, clientId, clientSecret);
    return NextResponse.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
