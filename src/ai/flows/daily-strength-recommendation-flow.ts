'use server';
/**
 * @fileOverview Génère UNE séance de musculation à faire aujourd'hui, à la
 * demande explicite de l'athlète depuis l'onglet Aujourd'hui — retour
 * utilisateur : "reintegrer la possibilité de... proposer une seance de
 * muscu (bien sur qui viendrais s'imbriquer dans le plan)". Distinct de
 * planWeekSessions (qui compose 1-3 séances muscu pour toute une semaine,
 * à la génération de la semaine) : ce flow compose UNE séance pour
 * AUJOURD'HUI précisément, en tenant compte de la récupération du moment —
 * même principe que dailyWorkoutRecommendation côté vélo, appliqué ici à
 * la musculation. L'appelant (use-daily-workout.ts) embarque le résultat
 * directement dans `sampleSessions` de la semaine du plan en cours
 * ("s'imbriquer dans le plan") — jamais une séance flottante en dehors du
 * plan.
 *
 * - dailyStrengthRecommendation - Runs the flow.
 * - DailyStrengthRecommendationInput / DailyStrengthRecommendationOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { STRENGTH_TRAINING_GUIDANCE } from './strength-training-guidance';
import { STRENGTH_SESSION_VALIDATION_GUIDANCE } from './strength-session-validation-guidance';
import { MovementPatternEnum, StrengthExerciseSchema } from './strength-exercise-schema';
import { PHASE_GUIDANCE } from './phase-guidance';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const DailyStrengthRecommendationInputSchema = z.object({
  date: z.string().describe('yyyy-MM-dd — aujourd\'hui.'),
  weekNumber: z.number().describe('Numéro de la semaine du plan en cours, pour ancrer le rationale.'),
  phase: z.enum(['base', 'build', 'peak', 'taper', 'recovery']).describe('Phase cycliste de la semaine du plan en cours — la musculation doit rester cohérente avec elle (ex. jamais une séance très lourde en phase affûtage/taper).'),
  focus: z.string().describe('Focus de la semaine du plan, tel que défini par trainingPlanGeneration.'),
  suggestedDurationMinutes: z.number().optional().describe('Durée indicative pour CETTE séance — reprise de la séance muscu déjà prévue par le plan cette semaine si une existe (même volume typique), sinon absente (le modèle choisit une durée raisonnable, 30-60 min).'),
  recentStrengthPatterns: z.array(z.array(MovementPatternEnum)).optional().describe('Movement patterns of the ~2 most recently logged/generated strength sessions, oldest first — for the S05 hip-hinge recency rule (see STRENGTH_SESSION_VALIDATION_GUIDANCE). Empty/absent if no history.'),
  training: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
    ftp: z.number().optional().describe('Functional Threshold Power (W), from Intervals.icu.'),
    weightKg: z.number().optional().describe('Athlete weight (kg), from Intervals.icu.'),
  }).optional().describe('Current Intervals.icu training load and physiological reference values, if connected.'),
  recovery: z.object({
    sleepHours: z.number().optional(),
    sleepQuality: z.number().optional().describe('0-100.'),
    hrv: z.number().optional(),
    hrvTrend: z.enum(['favorable', 'stable', 'defavorable']).nullable().optional().describe('Tendance HRV réelle, 7 derniers jours vs 28 jours de référence (même calcul que le gouverneur de charge interne) — jamais à deviner depuis la valeur brute ci-dessus. Absent/null si historique insuffisant.'),
    restingHR: z.number().optional(),
    restingHRTrend: z.enum(['favorable', 'stable', 'defavorable']).nullable().optional().describe('Tendance FC repos réelle, même fenêtre 7j vs 28j que hrvTrend — favorable = FC repos en baisse.'),
    readiness: z.number().optional().describe('0-100, formule transparente sleep/stress/mood/HRV/FC repos déjà calculée côté app.'),
  }).optional().describe('Récupération de la nuit passée — une mauvaise récupération doit réduire le volume/l\'intensité de CETTE séance (favoriser sessionType "entretien" plutôt que "principale"), même principe que dailyWorkoutRecommendation côté vélo.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the daily strength recommendation flow.');

export type DailyStrengthRecommendationInput = z.infer<typeof DailyStrengthRecommendationInputSchema>;

const DailyStrengthRecommendationOutputSchema = withCoachOutputContract({
  session: z.object({
    title: z.string().describe('Short session name, e.g. "Force bas du corps".'),
    durationMinutes: z.number().describe('Total planned duration including warmup/cooldown.'),
    intensityLabel: z.string().describe('One or two words, e.g. "Force", "Entretien".'),
    rationale: z.string().min(1).describe('1-2 sentences in French: why this session fits today (phase/focus/récupération).'),
    sessionType: z.enum(['principale', 'entretien', 'top-up']).describe('"principale" doit satisfaire le minimum de couverture de patterns S05 (≥4/6 dont bilateral-heavy) ; "entretien"/"top-up" sont exemptés (1-2 exercices possibles) — à préférer si la récupération du jour est mauvaise.'),
    strengthPhase: z.enum(['base', 'force-max', 'transfert-puissance', 'entretien']).describe('Détermine la matrice charge/reps/repos S05 que chaque exercice doit respecter.'),
    strengthExercises: z.array(StrengthExerciseSchema).min(1).describe('3-6 exercices pour une séance "principale" ; 1-2 pour "entretien"/"top-up".'),
  }).describe('La séance de musculation du jour.'),
}).describe('Output of the daily strength recommendation flow.');

export type DailyStrengthRecommendationOutput = z.infer<typeof DailyStrengthRecommendationOutputSchema>;

export async function dailyStrengthRecommendation(input: DailyStrengthRecommendationInput): Promise<FlowResult<DailyStrengthRecommendationOutput>> {
  try {
  const parsedInput = DailyStrengthRecommendationInputSchema.parse(input);

  const sections: string[] = [
    `AUJOURD'HUI : ${parsedInput.date} — SEMAINE ${parsedInput.weekNumber} DU PLAN, PHASE : ${parsedInput.phase}`,
    PHASE_GUIDANCE[parsedInput.phase],
    `FOCUS DE LA SEMAINE : ${parsedInput.focus}`,
    parsedInput.suggestedDurationMinutes != null
      ? `DURÉE INDICATIVE : ${parsedInput.suggestedDurationMinutes} minutes (volume typique de la séance muscu déjà prévue cette semaine — s'en approcher, ±20%, sauf si la récupération du jour justifie clairement de réduire).`
      : 'DURÉE INDICATIVE : aucune — choisis une durée raisonnable (30-60 minutes) selon la phase et la récupération.',
  ];

  const recentPatterns = parsedInput.recentStrengthPatterns ?? [];
  sections.push(
    recentPatterns.length > 0
      ? `PATTERNS DES DERNIÈRES SÉANCES DE MUSCULATION (de la plus ancienne à la plus récente, pour la règle hip-hinge S05) :\n${recentPatterns.map((p, i) => `  - Séance -${recentPatterns.length - i} : ${p.join(', ') || 'aucun pattern enregistré'}`).join('\n')}`
      : 'PATTERNS DES DERNIÈRES SÉANCES DE MUSCULATION : aucun historique disponible.'
  );

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CHARGE D\'ENTRAÎNEMENT ACTUELLE (Intervals.icu, contexte général) :',
      `CTL (fitness) : ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue) : ${t.atl ?? 'n/a'}`,
      `TSB (forme) : ${t.tsb ?? 'n/a'}`,
      `FTP : ${t.ftp != null ? `${t.ftp} W` : 'n/a'}`,
      `Poids : ${t.weightKg != null ? `${t.weightKg} kg` : 'n/a'}`,
    ].join('\n'));
  }

  if (parsedInput.recovery) {
    const r = parsedInput.recovery;
    sections.push([
      'RÉCUPÉRATION DE LA NUIT PASSÉE :',
      `Sommeil : ${r.sleepHours != null ? `${r.sleepHours}h` : 'n/a'}${r.sleepQuality != null ? ` (qualité ${r.sleepQuality}/100)` : ''}`,
      `HRV : ${r.hrv != null ? `${r.hrv}ms` : 'n/a'}${r.hrvTrend ? ` — tendance ${r.hrvTrend}` : ''}`,
      `FC repos : ${r.restingHR != null ? `${r.restingHR}bpm` : 'n/a'}${r.restingHRTrend ? ` — tendance ${r.restingHRTrend}` : ''}`,
      `Readiness : ${r.readiness != null ? `${r.readiness}/100` : 'n/a'}`,
    ].join('\n'));
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach de musculation expert, en complément d'un plan cycliste. Propose UNE séance de
musculation pour AUJOURD'HUI précisément — pas la répartition idéale d'une semaine entière (ça, c'est le
rôle d'un autre flow), mais la séance concrète du jour, cohérente avec la phase cycliste en cours et la
récupération réelle de la nuit passée.

Règles impératives :
- Si la récupération du jour (sommeil/HRV/FC repos/readiness ci-dessus, quand fournis) est dégradée, préfère
  un sessionType "entretien" ou "top-up" (volume/intensité réduits) plutôt que "principale" — dis-le
  explicitement dans le rationale. Sans données de récupération fournies, procède normalement.
- Reste cohérent avec la phase cycliste de la semaine (voir guidance ci-dessus) — jamais une séance très
  lourde en phase affûtage/taper, par exemple.
- Si la FTP/le poids est fourni, ancre le rationale dans des chiffres réels quand pertinent (ex. charge en
  kg plutôt qu'en %1RM seul, si le contexte le permet) — sinon reste en %1RM/ressenti, ne l'invente jamais.
- S'il y a une blessure active, adapte le contenu et mentionne l'adaptation dans le rationale.
- N'invente pas de données manquantes — travaille avec ce qui est fourni.
- ${STRENGTH_TRAINING_GUIDANCE}
- ${STRENGTH_SESSION_VALIDATION_GUIDANCE}

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme
(plus les champs de contrat obligatoires décrits plus haut — "summary" résume la séance en une phrase,
"recommendation" indique le point le plus important à respecter en la faisant) :
{
  "session": {
    "title": "nom court de la séance",
    "durationMinutes": nombre,
    "intensityLabel": "ex. Force",
    "rationale": "1 à 2 phrases",
    "sessionType": "principale|entretien|top-up",
    "strengthPhase": "base|force-max|transfert-puissance|entretien",
    "strengthExercises": [
      { "name": "ex. Squat", "pattern": "bilateral-heavy|hip-hinge|unilateral|anti-extension|anti-rotation-lateral|ankle-calf", "sets": nombre, "reps": "ex. 5 ou 8-10 — DOIT correspondre à repsMin/repsMax", "repsMin": nombre, "repsMax": nombre, "pct1RMMin": nombre ou null, "pct1RMMax": nombre ou null, "loadGuidance": "ex. charge lourde (RPE 8-9)", "restSeconds": nombre ou null }
    ]
  }
}`;

  return invokeCoachJson(DailyStrengthRecommendationOutputSchema, {
    flowId: 'dailyStrengthRecommendation',
    taskSystemPrompt: system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    maxTokens: 4096,
  });
  } catch (e) {
    console.error('[dailyStrengthRecommendation] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
