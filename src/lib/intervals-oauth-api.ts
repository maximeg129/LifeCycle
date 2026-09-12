/**
 * Client OAuth Intervals.icu — chantier "repenser planification/séances/
 * feedback" (pièce B2, voir CLAUDE.md). Documentation officielle collée
 * par l'utilisateur (forum.intervals.icu) — reproduite fidèlement ici,
 * jamais devinée.
 *
 * Prérequis externe incontournable, jamais géré par ce fichier :
 * l'utilisateur doit créer une "Application" sur son propre compte
 * Intervals.icu (https://intervals.icu/oauth/apply, en étant connecté
 * comme l'athlète propriétaire), attendre son approbation (statut
 * "Pending" → approuvé, délai hors du contrôle de cette app), puis
 * fournir client_id/client_secret via INTERVALS_OAUTH_CLIENT_ID/
 * INTERVALS_OAUTH_CLIENT_SECRET (apphosting.yaml) — jamais côté client,
 * l'échange de code exige le client_secret. Distinct de la clé API
 * personnelle déjà utilisée partout ailleurs dans l'app
 * (users/{uid}/settings/intervals) — ce mécanisme OAuth est ADDITIONNEL,
 * uniquement nécessaire pour recevoir les webhooks (voir
 * /api/intervals/webhook/route.ts), jamais un remplacement.
 *
 * ⚠️ Pas de refresh_token documenté dans la réponse d'échange (contrairement
 * à Strava) — jamais inventé : ce fichier ne construit donc aucun mécanisme
 * de rafraîchissement. Sans conséquence pratique aujourd'hui : le jeton
 * n'est utilisé nulle part pour appeler l'API Intervals.icu au jour le jour
 * (la clé API personnelle de l'athlète couvre déjà tous ces appels, y
 * compris depuis le webhook — voir son commentaire) ; seul son rôle est
 * d'établir la correspondance athlete_id↔uid à la connexion et de permettre
 * la révocation à la déconnexion. Si le jeton expirait un jour côté
 * Intervals.icu sans qu'on le sache, la seule conséquence serait un échec
 * silencieux (best-effort) du bouton "Déconnecter" — jamais une panne du
 * reste de l'app.
 */

const INTERVALS_BASE = 'https://intervals.icu';

export interface IntervalsOAuthTokenResponse {
  token_type: string;
  access_token: string;
  scope: string;
  athlete: { id: string; name: string };
}

async function describeIntervalsOAuthError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return `Intervals.icu OAuth Error ${response.status}: ${response.statusText}${text ? ` — ${text.slice(0, 300)}` : ''}`;
}

/**
 * Échange le `code` reçu du callback OAuth contre un jeton d'accès — DOIT
 * se faire dans les 2 minutes suivant l'autorisation (délai imposé par
 * Intervals.icu, voir leur doc). Forme exacte du corps (form-encoded,
 * jamais JSON) reproduite telle que documentée — aucun `redirect_uri` dans
 * cet appel, contrairement à Strava, jamais ajouté sur une supposition.
 */
export async function exchangeIntervalsOAuthCode(code: string, clientId: string, clientSecret: string): Promise<IntervalsOAuthTokenResponse> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code });
  const response = await fetch(`${INTERVALS_BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(await describeIntervalsOAuthError(response));
  return response.json();
}

/**
 * Révoque l'autorisation OAuth (déconnexion) — arrête la livraison des
 * webhooks pour cet athlète côté Intervals.icu (confirmé par leur doc :
 * "This will stop webhook delivery for the athlete").
 */
export async function disconnectIntervalsOAuthApp(accessToken: string): Promise<void> {
  const response = await fetch(`${INTERVALS_BASE}/api/v1/disconnect-app`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(await describeIntervalsOAuthError(response));
}
