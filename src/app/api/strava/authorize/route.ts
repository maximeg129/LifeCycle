import { NextRequest, NextResponse } from 'next/server';

/**
 * Redirige vers l'écran d'autorisation Strava — étape 1 de l'OAuth
 * "Authorization Code" (https://developers.strava.com/docs/authentication/).
 * `redirect_uri` est reconstruit depuis la requête elle-même plutôt qu'une
 * valeur figée en dur : Firebase App Hosting attribue un domaine
 * *.hosted.app dynamique par backend (voir next.config.ts, allowedOrigins),
 * donc aucune URL fixe ne serait fiable d'un déploiement à l'autre — c'est
 * à l'athlète de renseigner CE domaine réel comme "Authorization Callback
 * Domain" côté Strava (developers.strava.com → My API Application).
 *
 * `state` porte l'uid Firebase de l'athlète, pour que le callback sache à
 * quel document Firestore rattacher les jetons reçus (cette app n'a pas de
 * session serveur — voir Authentification, CLAUDE.md). ⚠️ Non signé :
 * même limite de confiance déjà documentée pour /api/intervals/* (aucune
 * vérification de token Firebase côté ces routes) — un state non signé
 * autorise en théorie un CSRF qui rattacherait le compte Strava d'un
 * attaquant au uid de la victime (l'app enverrait alors les futures
 * activités exportées vers CE compte Strava) ; ça n'expose aucune donnée
 * Firestore (les règles restent le vrai périmètre de protection), risque
 * documenté plutôt que corrigé pour l'instant — voir la section sécurité
 * de CLAUDE.md.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'STRAVA_CLIENT_ID non configuré côté serveur.' }, { status: 500 });
  }
  const uid = request.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'Paramètre uid manquant.' }, { status: 400 });
  }

  const redirectUri = new URL('/api/strava/callback', request.nextUrl.origin).toString();
  const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('approval_prompt', 'auto');
  // activity:write seul suffit — cette intégration ne fait jamais de
  // lecture Strava (voir portée, CLAUDE.md "Publication Strava").
  authorizeUrl.searchParams.set('scope', 'activity:write');
  authorizeUrl.searchParams.set('state', uid);

  return NextResponse.redirect(authorizeUrl.toString());
}
