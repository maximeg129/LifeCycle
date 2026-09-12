import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { adminFirestore } from '@/lib/firebase-admin';
import { sendPushNotification } from '@/lib/push-notifications';
import { IntervalsService, bestAverageWatts, bestRpe, feelToScore } from '@/lib/intervals-api';
import { buildCoachContext, type CoachContextInjury, type CoachContextGoal, type CoachContextLifestyle } from '@/components/cycling/coach-context';
import { rideAnalysis } from '@/ai/flows/ride-analysis-flow';

/**
 * Webhook Intervals.icu — chantier "repenser planification/séances/
 * feedback" (pièce B2, voir CLAUDE.md). Déclenche l'analyse IA automatique
 * d'une sortie vélo dès qu'Intervals.icu la signale comme analysée, même
 * app fermée — pendant vélo de B3 (analyse muscu automatique côté client).
 *
 * ⚠️ URL à renseigner sur la page "Manage App" d'Intervals.icu (voir la
 * doc collée par l'utilisateur) une fois l'application approuvée — jamais
 * vérifiable depuis ce sandbox (accès réseau à intervals.icu bloqué, même
 * limite documentée partout ailleurs dans ce fichier).
 *
 * ⚠️ Portée volontairement réduite ("version légère", même discipline que
 * le plan glissant 7 jours) par rapport à l'analyse déclenchée manuellement
 * depuis le Journal (use-ride-analysis.ts) :
 * - PAS de flux watts/FC seconde par seconde (getActivityStreams) — donc
 *   pas de zones de puissance/FC, pas de pacing, pas de durabilité, pas de
 *   découplage cardiaque. Juste les champs déjà présents sur l'activité
 *   elle-même (puissance moyenne/normalisée, charge, RPE, feel...).
 * - PAS de gouverneur de charge interne ni de budget kJ (buildCoachContext
 *   les reçoit `undefined` — champs rendus optionnels pour ce chantier,
 *   voir coach-context.ts) : leur calcul exige plusieurs semaines de
 *   wellness/activités/feedback déjà assemblées côté client
 *   (use-governor.ts/use-kj-budget.ts), une duplication de logique
 *   substantielle et invérifiable depuis ce sandbox — jugée trop risquée
 *   pour un chemin qui écrit directement une donnée affichée à l'athlète.
 * - PAS de comparaison à la séance prévue (plannedWorkout/intervalAdherence)
 *   — même raison de portée.
 * Une vraie analyse néanmoins, jamais un texte générique : `rideAnalysis`
 * dégrade déjà proprement sur des données partielles (voir son prompt).
 * L'athlète garde la main pour une analyse plus complète via "Régénérer"
 * dans le Journal, qui passe toujours par le chemin client complet.
 */

interface IntervalsWebhookEvent {
  athlete_id: string;
  type: string;
  timestamp: string;
  /** ⚠️ Forme non vérifiable depuis ce sandbox — la doc collée par
   * l'utilisateur ne montre que `{...}` pour ce champ. On assume un `id`
   * (comme partout ailleurs dans l'app, IntervalsActivity.id) ; si le champ
   * réel s'appelle différemment, cet événement sera simplement ignoré
   * (guard ci-dessous), jamais une exception qui casserait le batch. */
  activity?: { id?: string };
}

interface IntervalsWebhookPayload {
  secret?: string;
  events?: IntervalsWebhookEvent[];
}

interface IntervalsCredentialsDoc {
  intervalsAthleteId?: string;
  intervalsApiKey?: string;
}

/** Traite un seul événement — jamais laissé remonter une exception au batch appelant (voir POST). */
async function processActivityAnalyzed(event: IntervalsWebhookEvent): Promise<void> {
  const activityId = event.activity?.id;
  if (!activityId) {
    console.error('[intervals-webhook] ACTIVITY_ANALYZED event without activity.id, skipping', event);
    return;
  }

  const db = adminFirestore();

  const mappingSnap = await db.collection('intervalsOAuthAthletes').doc(event.athlete_id).get();
  const uid = (mappingSnap.data() as { uid?: string } | undefined)?.uid;
  if (!uid) {
    // Athlète non connecté via OAuth à cette app (ou jamais lié) — rien à faire.
    return;
  }

  // Déjà analysée (une régénération manuelle depuis le Journal, ou un
  // webhook redélivré par Intervals.icu) — jamais un deuxième appel IA
  // silencieux pour la même sortie. L'athlète garde "Régénérer" pour une
  // analyse volontairement rafraîchie.
  const analysisRef = db.doc(`users/${uid}/rideAnalyses/${activityId}`);
  const existing = await analysisRef.get();
  if (existing.exists) return;

  const credsSnap = await db.doc(`users/${uid}/settings/intervals`).get();
  const creds = credsSnap.data() as IntervalsCredentialsDoc | undefined;
  if (!creds?.intervalsAthleteId || !creds?.intervalsApiKey) {
    // Clé API personnelle absente/révoquée depuis la connexion OAuth —
    // rien à faire, aucun moyen d'appeler l'API pour cet athlète.
    return;
  }

  const service = new IntervalsService(creds.intervalsAthleteId, creds.intervalsApiKey);
  const [activity, athlete] = await Promise.all([
    service.getActivity(activityId),
    service.getAthlete().catch(() => null),
  ]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const activityDate = activity.start_date_local?.slice(0, 10) ?? today;

  const [injuriesSnap, goalsSnap, lifestyleSnap, factsSnap] = await Promise.all([
    db.collection(`users/${uid}/coachInjuries`).get(),
    db.collection(`users/${uid}/coachGoals`).get(),
    db.doc(`users/${uid}/coachMemory/lifestyle`).get(),
    db.doc(`users/${uid}/coachMemory/facts`).get(),
  ]);
  const injuries = injuriesSnap.docs.map((d) => d.data() as CoachContextInjury);
  const goals = goalsSnap.docs.map((d) => d.data() as CoachContextGoal);
  const lifestyle = (lifestyleSnap.data() as CoachContextLifestyle | undefined) ?? null;
  const rememberedFacts = (factsSnap.data() as { items?: string[] } | undefined)?.items ?? [];

  const coachContext = buildCoachContext({ today, injuries, lifestyle, goals, rememberedFacts });

  const avgWatts = bestAverageWatts(activity) ?? undefined;

  const result = await rideAnalysis({
    activity: {
      name: activity.name ?? undefined,
      type: activity.type ?? undefined,
      date: activityDate,
      distanceKm: activity.distance != null ? Math.round(activity.distance / 100) / 10 : undefined,
      durationMinutes: activity.moving_time != null ? Math.round(activity.moving_time / 60) : 0,
      avgWatts,
      normalizedWatts: activity.icu_weighted_avg_watts ?? activity.weighted_average_watts ?? undefined,
      avgHeartrate: activity.average_heartrate ?? undefined,
      maxHeartrate: activity.max_heartrate ?? undefined,
      elevationGainM: activity.total_elevation_gain ?? undefined,
      trainingLoad: activity.icu_training_load ?? undefined,
      intensity: activity.icu_intensity ?? undefined,
      rpe: bestRpe(activity) ?? undefined,
      feel: feelToScore(activity) ?? undefined,
    },
    athlete: athlete ? { ftp: athlete.ftp, ctl: athlete.ctl, atl: athlete.atl, tsb: athlete.tsb } : undefined,
    coachContext,
  });

  if (!result.ok) {
    console.error('[intervals-webhook] rideAnalysis failed:', result.error);
    return;
  }

  await analysisRef.set({
    userId: uid,
    analysis: result.data,
    // Jamais calculés dans ce chemin réduit (voir le commentaire d'en-tête)
    // — `null`, jamais `undefined` (Firestore le refuse), et jamais un
    // chiffre inventé à la place.
    durability: null,
    decoupling: null,
    plannedWorkout: null,
    intervalAdherence: null,
    createdAt: new Date().toISOString(),
  });

  await sendPushNotification(uid, {
    title: 'Analyse de sortie prête',
    body: activity.name || 'Votre sortie a été analysée automatiquement.',
    url: '/coach?tab=journal',
  });
}

export async function POST(request: NextRequest) {
  let payload: IntervalsWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const expectedSecret = process.env.INTERVALS_WEBHOOK_SECRET;
  if (!expectedSecret || payload.secret !== expectedSecret) {
    console.error('[intervals-webhook] secret mismatch or not configured');
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // Un événement qui échoue ne doit jamais empêcher les autres d'être
  // traités — chacun est isolé dans son propre try/catch, et la réponse
  // reste 200 dans tous les cas : c'est un accusé de réception pour
  // Intervals.icu, pas un verdict par événement.
  for (const event of payload.events ?? []) {
    if (event.type !== 'ACTIVITY_ANALYZED') continue;
    try {
      await processActivityAnalyzed(event);
    } catch (e) {
      console.error('[intervals-webhook] event processing failed:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
