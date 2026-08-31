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
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const PlanWeekSessionsInputSchema = z.object({
  weekNumber: z.number(),
  phase: z.enum(['base', 'build', 'peak', 'taper', 'recovery']),
  focus: z.string().describe('The week\'s training focus, from the plan.'),
  targetWeeklyMinutes: z.number().describe('This week\'s target training volume — the example sessions\' durations should sum to approximately this.'),
  notes: z.string().optional().describe('Any plan note specific to this week.'),
  sportType: z.string().optional().describe('Preferred Intervals.icu sport type (e.g. "Ride"). Defaults to "Ride".'),
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

const PlanWeekSessionSchema = z.object({
  title: z.string().describe('Short session name, e.g. "Endurance 90min" or "Seuil 4x8min".'),
  sportType: z.string().describe('Intervals.icu sport type, e.g. "Ride".'),
  durationMinutes: z.number().describe('Total planned duration including warmup/cooldown.'),
  intensityLabel: z.string().describe('One or two words, e.g. "Endurance", "Seuil", "Récupération active".'),
  rationale: z.string().describe('1-2 sentences in French: why this session fits the week\'s phase/focus.'),
  structuredWorkout: z.string().describe('Intervals.icu workout-builder text script — see system prompt for the exact syntax.'),
});

const PlanWeekSessionsOutputSchema = withCoachOutputContract({
  sessions: z.array(PlanWeekSessionSchema).describe('2 to 5 example sessions for the week, varied in type, whose durationMinutes sum to approximately targetWeeklyMinutes (±20%).'),
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
- La somme des durationMinutes de toutes les séances doit être proche de VOLUME CIBLE DE LA SEMAINE
  (±20% maximum).
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

${STRUCTURED_WORKOUT_SYNTAX}

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme
(plus les champs de contrat obligatoires décrits plus haut — "summary" résume la répartition de la semaine
en une phrase, "recommendation" indique quelle séance prioriser si le temps manque) :
{
  "sessions": [
    {
      "title": "nom court de la séance",
      "sportType": "type Intervals.icu, ex. Ride",
      "durationMinutes": nombre,
      "intensityLabel": "un ou deux mots",
      "rationale": "1 à 2 phrases expliquant pourquoi cette séance colle à la phase/au focus de la semaine",
      "structuredWorkout": "script structuré en sections + étapes, voir le format ci-dessus"
    }
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
