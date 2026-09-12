import { NextRequest, NextResponse } from 'next/server';
import { exchangeIntervalsOAuthCode } from '@/lib/intervals-oauth-api';
import { resolvePublicOrigin } from '@/lib/request-origin';
import { adminFirestore } from '@/lib/firebase-admin';

/**
 * Étape 2 de l'OAuth Intervals.icu (chantier B2, voir CLAUDE.md) — échange
 * le `code` contre un jeton (a besoin d'INTERVALS_OAUTH_CLIENT_SECRET,
 * donc côté serveur uniquement, ET dans les 2 minutes suivant
 * l'autorisation — délai imposé par Intervals.icu).
 *
 * Deux écritures, à deux endroits différents et pour deux raisons
 * différentes :
 * 1. `intervalsOAuthAthletes/{athleteId}` (Admin SDK, adminFirestore()) —
 *    LA correspondance dont /api/intervals/webhook a besoin pour retrouver
 *    le uid à partir du seul athlete_id que porte un événement webhook.
 *    Écrite ICI, côté serveur, parce que l'athlete_id vient de la réponse
 *    D'ÉCHANGE elle-même (vérifiée directement auprès d'Intervals.icu,
 *    jamais une valeur que le client pourrait falsifier) — c'est
 *    précisément ce qui rend cette écriture sûre à faire sans passer par
 *    les règles Firestore normales (voir le commentaire de la règle
 *    elle-même, firestore.rules).
 * 2. `users/{uid}/settings/intervalsOAuth` — les infos à afficher/gérer
 *    depuis Réglages (statut connecté, athleteId, déconnexion). Comme pour
 *    Strava, remonté au CLIENT via le FRAGMENT d'URL (`#...`, jamais la
 *    query string — voir le commentaire de /api/strava/callback pour le
 *    raisonnement complet) plutôt qu'écrit directement ici : cette donnée
 *    est scopée sous le uid du propriétaire, écrire côté client reste
 *    cohérent avec le reste de l'app (voir Authentification, CLAUDE.md) et
 *    ne pose pas le même risque que la mapping globale ci-dessus.
 */
export async function GET(request: NextRequest) {
  const origin = resolvePublicOrigin(request.headers, request.nextUrl.origin);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/settings?intervals_oauth_error=${encodeURIComponent(error)}`, origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?intervals_oauth_error=missing_code', origin));
  }

  const clientId = process.env.INTERVALS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.INTERVALS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?intervals_oauth_error=not_configured', origin));
  }

  try {
    const tokens = await exchangeIntervalsOAuthCode(code, clientId, clientSecret);
    const athleteId = tokens.athlete?.id;
    if (!athleteId) {
      return NextResponse.redirect(new URL('/settings?intervals_oauth_error=missing_athlete_id', origin));
    }

    // Voir le commentaire d'en-tête, point 1 — la seule écriture qui
    // compte pour que le webhook fonctionne un jour.
    await adminFirestore().collection('intervalsOAuthAthletes').doc(athleteId).set({
      uid: state,
      connectedAt: new Date().toISOString(),
    });

    const payload = Buffer.from(JSON.stringify({
      accessToken: tokens.access_token,
      athleteId,
      athleteName: tokens.athlete?.name ?? null,
      scope: tokens.scope,
      uid: state,
    })).toString('base64url');
    return NextResponse.redirect(new URL(`/settings#intervals_oauth_tokens=${payload}`, origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.redirect(new URL(`/settings?intervals_oauth_error=${encodeURIComponent(message)}`, origin));
  }
}
