import { NextRequest, NextResponse } from 'next/server';
import { resolvePublicOrigin } from '@/lib/request-origin';

/**
 * Redirige vers l'écran d'autorisation Intervals.icu — étape 1 du flow
 * OAuth (chantier B2, voir CLAUDE.md). Même mécanique que
 * /api/strava/authorize (voir son commentaire pour le détail complet du
 * bug `0.0.0.0:8080` déjà corrigé et confirmé pour Strava) :
 * `redirect_uri` reconstruit via `resolvePublicOrigin()` plutôt qu'une
 * valeur figée, Firebase App Hosting attribuant un domaine dynamique.
 *
 * `state` porte l'uid Firebase — même limite de confiance déjà documentée
 * pour Strava (non signé, risque de CSRF théorique documenté plutôt que
 * corrigé, voir CLAUDE.md section sécurité) : le vrai périmètre de
 * protection reste les règles Firestore, jamais contournées par cette
 * faiblesse (le pire cas rattache le mapping athlete_id→uid d'un attaquant
 * à sa propre victime, pas un accès aux données de la victime).
 *
 * Scope `ACTIVITY:READ` seul : cette intégration ne fait jamais d'écriture
 * via ce jeton OAuth (les écritures existantes — plan, muscu — continuent
 * de passer par la clé API personnelle déjà en place) et n'a même pas
 * besoin de LIRE via ce jeton au quotidien (voir intervals-oauth-api.ts) —
 * seule sa PRÉSENCE (l'autorisation elle-même) déclenche la livraison des
 * webhooks côté Intervals.icu.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.INTERVALS_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'INTERVALS_OAUTH_CLIENT_ID non configuré côté serveur.' }, { status: 500 });
  }
  const uid = request.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'Paramètre uid manquant.' }, { status: 400 });
  }

  const redirectUri = new URL('/api/intervals-oauth/callback', resolvePublicOrigin(request.headers, request.nextUrl.origin)).toString();
  const authorizeUrl = new URL('https://intervals.icu/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'ACTIVITY:READ');
  authorizeUrl.searchParams.set('state', uid);

  return NextResponse.redirect(authorizeUrl.toString());
}
