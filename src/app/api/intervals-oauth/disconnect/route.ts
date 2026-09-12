import { NextRequest, NextResponse } from 'next/server';
import { disconnectIntervalsOAuthApp } from '@/lib/intervals-oauth-api';
import { adminFirestore } from '@/lib/firebase-admin';

/**
 * Révoque l'autorisation OAuth Intervals.icu (déconnexion depuis Réglages)
 * — voir use-intervals-oauth.ts. Best-effort côté Intervals.icu (même
 * discipline que /api/strava/deauthorize) : le document Firestore local
 * de l'athlète est supprimé côté client même si cet appel échoue.
 *
 * Nettoie EN PLUS le mapping Admin `intervalsOAuthAthletes/{athleteId}`
 * (voir /api/intervals-oauth/callback pour pourquoi cette écriture doit
 * rester server-only) — sans ça, un webhook reçu après déconnexion
 * retrouverait encore un uid, pour un athlète qui ne s'attend plus à
 * recevoir d'analyse automatique.
 */
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get('x-intervals-oauth-access-token');
  const athleteId = request.headers.get('x-intervals-oauth-athlete-id');
  if (!accessToken || !athleteId) {
    return NextResponse.json({ error: 'Jeton ou athleteId Intervals.icu manquant.' }, { status: 401 });
  }

  try {
    await disconnectIntervalsOAuthApp(accessToken);
  } catch {
    // Best-effort — voir le commentaire d'en-tête. On nettoie quand même
    // notre propre mapping ci-dessous.
  }

  try {
    await adminFirestore().collection('intervalsOAuthAthletes').doc(athleteId).delete();
  } catch {
    // Best-effort également — au pire un mapping orphelin, sans
    // conséquence de sécurité (le webhook suivant échouera juste à
    // retrouver la clé API personnelle à l'étape d'après, voir
    // /api/intervals/webhook, et sera ignoré silencieusement).
  }

  return NextResponse.json({ ok: true });
}
