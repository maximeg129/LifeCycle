import { NextRequest, NextResponse } from 'next/server';
import { exchangeStravaCode } from '@/lib/strava-api';

/**
 * Étape 2 de l'OAuth Strava — échange le `code` contre les jetons (a
 * besoin de STRAVA_CLIENT_SECRET, donc côté serveur uniquement) puis
 * redirige vers /settings avec les jetons dans le FRAGMENT d'URL (`#...`),
 * jamais dans la query string : un fragment n'est jamais transmis au
 * serveur par le navigateur après cette redirection (contrairement à une
 * query string, qui finirait dans les journaux d'accès de l'hébergeur).
 * Cette app n'a pas de session serveur ni de store partagé pour un jeton
 * d'échange à usage unique (voir Authentification, CLAUDE.md — pas de
 * Firebase Admin SDK côté serveur) : le fragment est le compromis
 * pragmatique déjà accepté ailleurs dans ce fichier pour ce type de
 * contrainte architecturale. `strava-card.tsx` lit ce fragment UNE SEULE
 * FOIS au montage et l'efface immédiatement de l'URL
 * (`history.replaceState`).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/settings?strava_error=${encodeURIComponent(error)}`, request.nextUrl.origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?strava_error=missing_code', request.nextUrl.origin));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?strava_error=not_configured', request.nextUrl.origin));
  }

  try {
    const tokens = await exchangeStravaCode(code, clientId, clientSecret);
    const payload = Buffer.from(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      athleteId: tokens.athlete?.id ?? null,
      uid: state,
    })).toString('base64url');
    return NextResponse.redirect(new URL(`/settings#strava_tokens=${payload}`, request.nextUrl.origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.redirect(new URL(`/settings?strava_error=${encodeURIComponent(message)}`, request.nextUrl.origin));
  }
}
