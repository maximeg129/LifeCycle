import { NextRequest, NextResponse } from 'next/server';
import { exchangeStravaCode } from '@/lib/strava-api';
import { resolvePublicOrigin } from '@/lib/request-origin';

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
  // ⚠️ Bug réel corrigé : `request.nextUrl.origin` résout à l'adresse
  // d'écoute interne du conteneur Cloud Run (`https://0.0.0.0:8080`), pas
  // au domaine public — voir le commentaire équivalent dans
  // /api/strava/authorize/route.ts. Sans ce correctif, ces redirections
  // renverraient le navigateur vers `https://0.0.0.0:8080/settings...`,
  // injoignable depuis l'extérieur du conteneur.
  const origin = resolvePublicOrigin(request.headers, request.nextUrl.origin);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/settings?strava_error=${encodeURIComponent(error)}`, origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?strava_error=missing_code', origin));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?strava_error=not_configured', origin));
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
    return NextResponse.redirect(new URL(`/settings#strava_tokens=${payload}`, origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.redirect(new URL(`/settings?strava_error=${encodeURIComponent(message)}`, origin));
  }
}
