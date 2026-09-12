// ── Origine publique d'une requête, derrière le proxy Firebase App Hosting ──
//
// Bug réel, confirmé en prod : les routes /api/strava/* construisaient leurs
// URLs (redirect_uri OAuth, redirections vers /settings) avec
// `request.nextUrl.origin` — qui s'est avéré résoudre à l'adresse d'écoute
// INTERNE du conteneur Cloud Run (`https://0.0.0.0:8080`), pas au domaine
// public `*.hosted.app` que le navigateur utilise réellement. Confirmé en
// lisant le `redirect_uri` effectivement envoyé à Strava (capture d'écran
// utilisateur) : Firebase App Hosting fronte le backend avec son propre
// proxy et réécrit le header `Host` pour le routage interne — exactement le
// même mécanisme déjà documenté dans CLAUDE.md pour `allowedOrigins`
// (Server Actions), mais qui casse ici un usage différent (une URL qu'on
// construit nous-mêmes, pas une vérification interne de Next.js).
//
// `x-forwarded-host`/`x-forwarded-proto` sont les en-têtes standard qu'un
// proxy inverse pose pour porter l'hôte/schéma d'origine tels que vus par
// le client — Firebase App Hosting les pose correctement même quand il
// réécrit `Host` lui-même. Repli sur `fallbackOrigin` (typiquement
// `request.nextUrl.origin`) en leur absence — cas du dev local (`next dev`,
// pas de proxy devant), où `nextUrl.origin` reste correct.

/** Sous-ensemble de `Headers` suffisant pour être testé sans dépendre de `next/server`. */
export interface HeaderLike {
  get(name: string): string | null
}

export function resolvePublicOrigin(headers: HeaderLike, fallbackOrigin: string): string {
  const forwardedHost = headers.get('x-forwarded-host')
  if (!forwardedHost) return fallbackOrigin
  const forwardedProto = headers.get('x-forwarded-proto') ?? 'https'
  return `${forwardedProto}://${forwardedHost}`
}
