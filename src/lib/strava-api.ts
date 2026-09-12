/**
 * Client OAuth + API Strava — publication d'une activité (musculation
 * uniquement, voir CLAUDE.md "Publication Strava"). Documentation :
 * https://developers.strava.com/docs/reference/
 *
 * Prérequis externe incontournable, jamais géré par ce fichier : une
 * application API Strava enregistrée par l'athlète sur son propre compte
 * (developers.strava.com → "My API Application"), fournissant le
 * client_id/client_secret lus depuis STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET
 * (voir apphosting.yaml) — jamais côté client, l'échange/rafraîchissement
 * de jeton exige le client_secret.
 */

const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number; // unix seconds
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function describeStravaError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  return `Strava API Error ${response.status}: ${response.statusText}${text ? ` — ${text.slice(0, 300)}` : ''}`;
}

/** Échange le `code` reçu du callback OAuth contre les jetons — grant_type=authorization_code. */
export async function exchangeStravaCode(code: string, clientId: string, clientSecret: string): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
  });
  if (!response.ok) throw new Error(await describeStravaError(response));
  return response.json();
}

/**
 * Rafraîchit un access_token expiré/proche d'expirer — grant_type=refresh_token.
 * Strava fait tourner le refresh_token à chaque appel : celui renvoyé DOIT
 * remplacer l'ancien côté stockage (voir use-strava.ts), jamais réutiliser
 * l'ancien pour un prochain rafraîchissement.
 */
export async function refreshStravaToken(refreshToken: string, clientId: string, clientSecret: string): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(await describeStravaError(response));
  return response.json();
}

/** Révoque l'accès (déconnexion) — https://developers.strava.com/docs/authentication/#deauthorization */
export async function deauthorizeStrava(accessToken: string): Promise<void> {
  const response = await fetch(`${STRAVA_OAUTH_BASE}/deauthorize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(await describeStravaError(response));
}

/**
 * Une activité RÉALISÉE manuelle (musculation) — même portée que
 * `ManualActivityInput` (intervals-api.ts), jamais une sortie vélo (voir
 * CLAUDE.md, portée volontairement limitée à la musculation : les sorties
 * vélo continuent d'arriver via Intervals.icu, jamais republiées ici).
 */
export interface ManualStravaActivityInput {
  name: string;
  /** yyyy-MM-dd — cette app ne suit pas d'heure de départ précise pour une séance muscu, seulement le jour (même limite que ManualActivityInput/Intervals.icu) ; l'heure est fixée à midi local plutôt que minuit pour éviter un horodatage trompeur. */
  startDateLocal: string;
  description: string;
  /**
   * Secondes — REQUIS par l'API Strava (`elapsed_time`), contrairement à
   * Intervals.icu où `moving_time` est optionnel. Jamais halluciné :
   * l'appelant doit s'assurer que cette valeur est réellement connue avant
   * d'appeler `createStravaActivity` (voir `canExportToStrava`,
   * use-strava-log-export.ts, qui désactive le bouton sinon plutôt que
   * d'inventer une durée).
   */
  durationSeconds: number;
}

/**
 * Construit le corps de la requête Strava — extrait en fonction pure pour
 * rester testable sans réseau (même discipline que `createManualActivity`,
 * intervals-api.ts).
 */
export function buildStravaActivityBody(activity: ManualStravaActivityInput) {
  return {
    name: activity.name,
    // "WeightTraining" est une valeur réelle de l'enum sport_type de
    // Strava (confirmée via leur documentation publique) — même
    // vocabulaire que `type` côté Intervals.icu pour cette même séance.
    sport_type: 'WeightTraining',
    start_date_local: `${activity.startDateLocal}T12:00:00Z`,
    elapsed_time: activity.durationSeconds,
    description: activity.description,
  };
}

export interface StravaActivityResult {
  id: number;
}

/**
 * Crée l'activité manuelle sur Strava — POST /api/v3/activities, Bearer
 * access_token. Pas d'upsert par id externe (comme Intervals.icu) :
 * renvoyer créerait un doublon, jamais une mise à jour — voir
 * `stravaActivityId` (strength-log-types.ts), la garde côté UI.
 */
export async function createStravaActivity(accessToken: string, activity: ManualStravaActivityInput): Promise<StravaActivityResult> {
  const response = await fetch(`${STRAVA_API_BASE}/activities`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildStravaActivityBody(activity)),
  });
  if (!response.ok) throw new Error(await describeStravaError(response));
  return response.json();
}
