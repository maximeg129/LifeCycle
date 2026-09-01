'use server';
/**
 * @fileOverview Proposes 2-5 concrete example sessions for one week of an
 * active training plan — the "ideal" breakdown of that week's targetWeeklyMinutes
 * given its phase/focus, NOT adapted to any particular day's actual
 * available time or recovery state (that's dailyWorkoutRecommendation's
 * job). Same structuredWorkout syntax and push-to-Intervals.icu path as
 * the daily proposal, so any of these sessions can be sent as-is once the
 * athlete picks a real date for it.
 *
 * - planWeekSessions - Runs the flow.
 * - PlanWeekSessionsInput / PlanWeekSessionsOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { STRUCTURED_WORKOUT_SYNTAX } from './structured-workout-syntax';
import { ON_BIKE_FUELING_GUIDANCE } from './on-bike-fueling-guidance';
import { STRENGTH_TRAINING_GUIDANCE } from './strength-training-guidance';
import { STRENGTH_SESSION_VALIDATION_GUIDANCE } from './strength-session-validation-guidance';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const MovementPatternEnum = z.enum(['bilateral-heavy', 'hip-hinge', 'unilateral', 'anti-extension', 'anti-rotation-lateral', 'ankle-calf']);

const PlanWeekSessionsInputSchema = z.object({
  weekNumber: z.number(),
  phase: z.enum(['base', 'build', 'peak', 'taper', 'recovery']),
  focus: z.string().describe('The week\'s training focus, from the plan.'),
  targetWeeklyMinutes: z.number().describe('This week\'s target training volume — the example sessions\' durations should sum to approximately this.'),
  notes: z.string().optional().describe('Any plan note specific to this week.'),
  sportType: z.string().optional().describe('Preferred Intervals.icu sport type (e.g. "Ride"). Defaults to "Ride".'),
  targetStrengthMinutes: z.number().optional().describe('This week\'s target strength-training volume, from the plan (PlanWeek.targetStrengthMinutes) — present ONLY when the athlete requested musculation for this plan. When present, ALSO generate 1-3 strength sessions (sessionKind "strength") summing close to this, in ADDITION to the cycling sessions (never counted toward targetWeeklyMinutes). When absent, NEVER produce a strength session.'),
  recentStrengthPatterns: z.array(z.array(MovementPatternEnum)).optional().describe('Movement patterns of the ~2 most recently logged strength sessions, oldest first — for the S05 hip-hinge recency rule (see STRENGTH_SESSION_VALIDATION_GUIDANCE). Empty/absent if no history.'),
  training: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
    ftp: z.number().optional().describe('Functional Threshold Power (W), from Intervals.icu.'),
    weightKg: z.number().optional().describe('Athlete weight (kg), from Intervals.icu.'),
  }).optional().describe('Current Intervals.icu training load and physiological reference values, if connected — general context, not a same-day snapshot.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the plan week sample sessions flow.');

export type PlanWeekSessionsInput = z.infer<typeof PlanWeekSessionsInputSchema>;

const StrengthExerciseSchema = z.object({
  name: z.string().describe('e.g. "Squat", "Presse à cuisses", "Fentes bulgares".'),
  pattern: MovementPatternEnum.describe('The ONE movement pattern this exercise primarily trains — see STRENGTH_SESSION_VALIDATION_GUIDANCE (S05) for the 6 patterns and which is mandatory.'),
  sets: z.number(),
  reps: z.string().describe('Human-readable display, e.g. "5" or "8-10" — MUST match repsMin/repsMax below exactly (e.g. "3-6" for repsMin=3/repsMax=6, or "5" if repsMin=repsMax=5).'),
  repsMin: z.number().describe('Lower bound of the rep count (equal to repsMax for a fixed number) — used for mechanical validation against the S05 phase matrix.'),
  repsMax: z.number().describe('Upper bound of the rep count.'),
  pct1RMMin: z.number().nullable().describe('Lower bound of estimated %1RM for THIS exercise, per the S05 matrix for the session\'s strengthPhase — null when not applicable (bodyweight/core work).'),
  pct1RMMax: z.number().nullable().describe('Upper bound of estimated %1RM — null when not applicable.'),
  loadGuidance: z.string().describe('Short qualitative complement, e.g. "charge lourde (RPE 8-9)" — alongside the numeric pct1RM range above, not a replacement for it.'),
  restSeconds: z.number().describe('Rest between sets, in seconds — per the S05 phase matrix (STRENGTH_SESSION_VALIDATION_GUIDANCE).'),
});

const PlanWeekSessionSchema = z.object({
  sessionKind: z.enum(['cycling', 'strength']).describe('"cycling" for a bike session (structuredWorkout/fueling apply), "strength" for a musculation session (strengthExercises applies instead) — see targetStrengthMinutes in the input.'),
  title: z.string().describe('Short session name, e.g. "Endurance 90min" or "Force bas du corps".'),
  sportType: z.string().describe('Intervals.icu sport type — "Ride" (or similar) for cycling, "WeightTraining" for strength.'),
  durationMinutes: z.number().describe('Total planned duration including warmup/cooldown.'),
  intensityLabel: z.string().describe('One or two words, e.g. "Endurance", "Seuil", "Récupération active", "Force".'),
  rationale: z.string().describe('1-2 sentences in French: why this session fits the week\'s phase/focus.'),
  structuredWorkout: z.string().optional().describe('CYCLING ONLY (sessionKind "cycling") — Intervals.icu workout-builder text script, see system prompt for the exact syntax. Absent for a strength session.'),
  sessionType: z.enum(['principale', 'entretien', 'top-up']).optional().describe('STRENGTH ONLY — "principale" must satisfy the S05 pattern-coverage minimum (≥4/6 patterns incl. bilateral-heavy) ; "entretien"/"top-up" are exempt (1-2 exercises allowed) but must NEVER silently replace the week\'s real principal strength session — say so explicitly in warnings if that\'s the case.'),
  strengthPhase: z.enum(['base', 'force-max', 'transfert-puissance', 'entretien']).optional().describe('STRENGTH ONLY — determines the S05 charge/reps/repos matrix each exercise\'s sets/repsMin/repsMax/pct1RM/restSeconds must be consistent with.'),
  strengthExercises: z.array(StrengthExerciseSchema).optional().describe('STRENGTH ONLY (sessionKind "strength") — 3-6 exercises. Absent for a cycling session.'),
  fueling: z.object({
    neededOnBike: z.boolean().describe("false quand la durée/intensité de CETTE séance ne justifie pas un apport glucidique pendant l'effort (repères S03/S04 : sous ~60-75min à intensité modérée, bénéfice non démontré) — jamais un apport inventé pour une séance courte."),
    carbGramsPerHourMin: z.number().nullable().describe('Borne basse de la fourchette de glucides recommandée (g/h) pour CETTE séance. Null si neededOnBike est false.'),
    carbGramsPerHourMax: z.number().nullable().describe('Borne haute — ne doit JAMAIS dépasser 120 (plafond sourcé R34). Null si neededOnBike est false.'),
    hydrationNote: z.string().nullable().describe("1 phrase de rappel hydratation/électrolytes si la durée le justifie (>60-70min), sinon null."),
    rationale: z.string().describe("1-2 phrases expliquant la fourchette choisie à partir de la durée/intensité RÉELLES de cette séance — jamais un chiffre générique."),
  }).optional().describe("CYCLING ONLY (sessionKind \"cycling\") — alimentation à avoir sur le vélo, ancrée dans la recherche fournie (voir guidage ci-dessous et S03/S04, la règle nutrition-carb-intake-guidance/R34), jamais un chiffre au hasard. Absent pour une séance de musculation."),
});

const PlanWeekSessionsOutputSchema = withCoachOutputContract({
  sessions: z.array(PlanWeekSessionSchema).describe('2 to 5 cycling example sessions (sessionKind "cycling"), varied in type, whose durationMinutes sum to approximately targetWeeklyMinutes (±20%) — PLUS 1-3 strength sessions (sessionKind "strength") ONLY when targetStrengthMinutes was provided in the input.'),
}).describe('Output of the plan week sample sessions flow.');

export type PlanWeekSessionsOutput = z.infer<typeof PlanWeekSessionsOutputSchema>;
export type PlanWeekSession = z.infer<typeof PlanWeekSessionSchema>;

const PHASE_GUIDANCE: Record<PlanWeekSessionsInput['phase'], string> = {
  base: 'Phase base : volume et endurance, intensité majoritairement basse (55-75% FTP). Peu ou pas de haute intensité.',
  build: 'Phase développement : intensité croissante et spécificité — introduit du seuil/sweet spot, garde une part d\'endurance.',
  peak: 'Phase pic : les séances les plus spécifiques et intenses du plan (seuil, VO2max, ou spécificité de l\'objectif) — le volume peut être plus bas qu\'en base/build mais l\'intensité est élevée.',
  taper: 'Phase affûtage : volume nettement réduit, mais garde un peu d\'intensité courte pour rester affûté — pas juste des sorties molles.',
  recovery: 'Phase récupération : volume et intensité réduits (~50-60% de la normale), quasi exclusivement en endurance légère.',
};

export async function planWeekSessions(input: PlanWeekSessionsInput): Promise<FlowResult<PlanWeekSessionsOutput>> {
  try {
  const parsedInput = PlanWeekSessionsInputSchema.parse(input);

  const sections: string[] = [
    `SEMAINE ${parsedInput.weekNumber} DU PLAN — PHASE : ${parsedInput.phase}`,
    PHASE_GUIDANCE[parsedInput.phase],
    `FOCUS DE LA SEMAINE : ${parsedInput.focus}`,
    `VOLUME CIBLE DE LA SEMAINE : ${parsedInput.targetWeeklyMinutes} minutes`,
    `SPORT PRÉFÉRÉ : ${parsedInput.sportType || 'Ride'}`,
  ];
  if (parsedInput.notes) sections.push(`NOTE SPÉCIFIQUE À CETTE SEMAINE : ${parsedInput.notes}`);
  if (parsedInput.targetStrengthMinutes != null) {
    sections.push(`MUSCULATION DEMANDÉE POUR CE PLAN : INCLURE_MUSCULATION=true — volume cible cette semaine : ${parsedInput.targetStrengthMinutes} minutes, séparé du volume vélo ci-dessus.`);
    const recentPatterns = parsedInput.recentStrengthPatterns ?? [];
    sections.push(
      recentPatterns.length > 0
        ? `PATTERNS DES DERNIÈRES SÉANCES DE MUSCULATION (de la plus ancienne à la plus récente, pour la règle hip-hinge S05) :\n${recentPatterns.map((p, i) => `  - Séance -${recentPatterns.length - i} : ${p.join(', ') || 'aucun pattern enregistré'}`).join('\n')}`
        : 'PATTERNS DES DERNIÈRES SÉANCES DE MUSCULATION : aucun historique disponible.'
    );
  }

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

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach cycliste expert. Propose entre 2 et 5 séances TYPE pour cette semaine
d'un plan d'entraînement — la répartition idéale du volume de la semaine étant donné sa phase et son focus.

Ce ne sont PAS des séances adaptées au temps réellement disponible un jour précis ni à une récupération
du moment — c'est la recommandation du coach pour "à quoi ressemblerait une semaine idéale ici", que
l'athlète pourra ensuite envoyer sur Intervals.icu s'il peut vraiment la faire tel quel.

Règles impératives :
- La somme des durationMinutes des séances "cycling" (uniquement) doit être proche de VOLUME CIBLE DE LA
  SEMAINE (±20% maximum) — les séances "strength" ont leur propre budget (targetStrengthMinutes ci-dessus,
  jamais mélangé au calcul du volume vélo).
- Varie le type de séance (pas 3x la même chose) — un mélange cohérent avec la phase (voir guidance
  ci-dessus) : par exemple en phase base, 2-3 sorties d'endurance de durées différentes plutôt qu'une
  seule très longue ; en phase build/peak, mélange une séance d'intensité avec des séances d'endurance
  de soutien.
- S'il y a une blessure active, adapte le contenu et mentionne l'adaptation dans le rationale de la
  séance concernée.
- Si la FTP est fournie, utilise-la pour ancrer le rationale de chaque séance dans des chiffres réels
  (ex: "seuil à 95% FTP, environ 260W" plutôt que "seuil" tout court) — le script structuré reste en % de
  FTP. Si la FTP n'est pas fournie (n/a ci-dessus), reste en %/ressenti, ne l'invente jamais.
- N'invente pas de données manquantes — travaille avec ce qui est fourni.
- Chaque séance a un "sessionKind" ("cycling" ou "strength") : une séance "cycling" porte structuredWorkout et
  fueling (jamais strengthExercises) ; une séance "strength" porte strengthExercises (jamais structuredWorkout
  ni fueling — l'alimentation à l'effort ne s'applique pas à une séance de musculation).
- ${ON_BIKE_FUELING_GUIDANCE}
${parsedInput.targetStrengthMinutes != null ? `- ${STRENGTH_TRAINING_GUIDANCE}\n- ${STRENGTH_SESSION_VALIDATION_GUIDANCE}` : "- Musculation non demandée pour ce plan : ne produis JAMAIS de séance sessionKind=\"strength\"."}

${STRUCTURED_WORKOUT_SYNTAX}

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme
(plus les champs de contrat obligatoires décrits plus haut — "summary" résume la répartition de la semaine
en une phrase, "recommendation" indique quelle séance prioriser si le temps manque) :
{
  "sessions": [
    {
      "sessionKind": "cycling",
      "title": "nom court de la séance",
      "sportType": "type Intervals.icu, ex. Ride",
      "durationMinutes": nombre,
      "intensityLabel": "un ou deux mots",
      "rationale": "1 à 2 phrases expliquant pourquoi cette séance colle à la phase/au focus de la semaine",
      "structuredWorkout": "script structuré en sections + étapes, voir le format ci-dessus",
      "fueling": {
        "neededOnBike": booléen,
        "carbGramsPerHourMin": nombre ou null,
        "carbGramsPerHourMax": nombre ou null,
        "hydrationNote": "rappel court ou null",
        "rationale": "1-2 phrases ancrées sur la durée/intensité réelles de cette séance"
      }
    }${parsedInput.targetStrengthMinutes != null ? `,
    {
      "sessionKind": "strength",
      "title": "nom court de la séance",
      "sportType": "WeightTraining",
      "durationMinutes": nombre,
      "intensityLabel": "ex. Force",
      "rationale": "1 à 2 phrases",
      "sessionType": "principale|entretien|top-up",
      "strengthPhase": "base|force-max|transfert-puissance|entretien",
      "strengthExercises": [
        { "name": "ex. Squat", "pattern": "bilateral-heavy|hip-hinge|unilateral|anti-extension|anti-rotation-lateral|ankle-calf", "sets": nombre, "reps": "ex. 5 ou 8-10 — DOIT correspondre à repsMin/repsMax", "repsMin": nombre, "repsMax": nombre, "pct1RMMin": nombre ou null, "pct1RMMax": nombre ou null, "loadGuidance": "ex. charge lourde (RPE 8-9)", "restSeconds": nombre }
      ]
    }` : ''}
  ]
}`;

  return invokeCoachJson(PlanWeekSessionsOutputSchema, {
    flowId: 'planWeekSessions',
    taskSystemPrompt: system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    maxTokens: 8192,
  });
  } catch (e) {
    console.error('[planWeekSessions] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
