'use server';
/**
 * @fileOverview Generates a periodized mid/long-term training plan toward a
 * goal: a week-by-week breakdown (phase, focus, target weekly volume) from
 * today until the event date. Deliberately does NOT generate individual
 * daily sessions — that's `dailyWorkoutRecommendation`'s job, which can
 * consult "which week/phase am I in" (see training-plan-types.ts's
 * currentPlanWeek) to shape each day's specific proposal. Calendar dates
 * for each week are computed deterministically by the caller
 * (buildPlanWeekSkeleton) rather than asked of the model — see that file's
 * header comment for why.
 *
 * - trainingPlanGeneration - Runs the flow.
 * - TrainingPlanGenerationInput / TrainingPlanGenerationOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const TrainingPlanGenerationInputSchema = z.object({
  today: z.string().describe('yyyy-MM-dd'),
  goal: z.object({
    eventName: z.string(),
    eventDate: z.string().describe('yyyy-MM-dd'),
    targetOutcome: z.string(),
    priority: z.number().describe('1 (prioritaire) to 3 (optionnel)'),
  }),
  weekCount: z.number().describe('Exact number of weeks to plan for — the output MUST contain exactly this many week entries, in order from today to the event.'),
  weeklyAvailableMinutes: z.number().describe('Typical minutes per week the athlete can train, at a normal (non-taper) week.'),
  training: z.object({
    ctl: z.number().optional().describe('Chronic Training Load (fitness)'),
    atl: z.number().optional().describe('Acute Training Load (fatigue)'),
    tsb: z.number().optional().describe('Training Stress Balance (form) = ctl - atl'),
  }).optional().describe('Current Intervals.icu training load, if connected.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the training plan generation flow.');

export type TrainingPlanGenerationInput = z.infer<typeof TrainingPlanGenerationInputSchema>;

const PlanPhaseEnum = z.enum(['base', 'build', 'peak', 'taper', 'recovery']);

const TrainingPlanGenerationOutputSchema = withCoachOutputContract({
  planName: z.string().describe('Short plan name, e.g. "Préparation Marmotte 2026".'),
  weeks: z.array(z.object({
    phase: PlanPhaseEnum,
    focus: z.string().describe('One short sentence: the week\'s training focus.'),
    targetWeeklyMinutes: z.number().describe('Target training minutes for this week — must not exceed weeklyAvailableMinutes except is allowed to be lower (deload/taper weeks).'),
    notes: z.string().optional().describe('Optional short note — only when something specific needs flagging for that week.'),
  })).describe('Exactly weekCount entries, in order, week 1 first.'),
  warnings: z.array(z.string()).describe('0-3 short things the athlete should know about this plan (e.g. injury-driven adaptation, aggressive timeline). Empty array if nothing stands out.'),
}).describe('Output of the training plan generation flow.');

export type TrainingPlanGenerationOutput = z.infer<typeof TrainingPlanGenerationOutputSchema>;

export async function trainingPlanGeneration(input: TrainingPlanGenerationInput): Promise<FlowResult<TrainingPlanGenerationOutput>> {
  try {
  const parsedInput = TrainingPlanGenerationInputSchema.parse(input);

  const sections: string[] = [
    `AUJOURD'HUI : ${parsedInput.today}`,
    `OBJECTIF : ${parsedInput.goal.eventName} le ${parsedInput.goal.eventDate} (priorité ${parsedInput.goal.priority}/3) — ${parsedInput.goal.targetOutcome}`,
    `DURÉE DU PLAN : ${parsedInput.weekCount} semaines, du ${parsedInput.today} jusqu'à l'objectif`,
    `VOLUME HEBDOMADAIRE DISPONIBLE (semaine normale) : ${parsedInput.weeklyAvailableMinutes} minutes`,
  ];

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CHARGE D\'ENTRAÎNEMENT ACTUELLE (Intervals.icu) :',
      `CTL (fitness) : ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue) : ${t.atl ?? 'n/a'}`,
      `TSB (forme) : ${t.tsb ?? 'n/a'}`,
    ].join('\n'));
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach cycliste expert en périodisation de l'entraînement. À partir du contexte fourni,
construis un plan d'entraînement semaine par semaine, du niveau actuel de l'athlète jusqu'à son objectif.

Principes de périodisation à respecter :
- Structure classique : phase "base" (endurance, volume) → "build" (intensité croissante, spécificité) →
  "peak" (pic de forme, séances les plus spécifiques/intenses) → "taper" (réduction du volume avant
  l'objectif, la charge chute mais l'intensité reste). Une phase "recovery" (semaine allégée, ~50-60% du
  volume normal) doit apparaître environ toutes les 3-4 semaines pour éviter le surentraînement.
- Les 1 à 2 dernières semaines avant l'objectif sont TOUJOURS en phase "taper", avec un volume nettement
  réduit (40-60% du volume normal).
- targetWeeklyMinutes ne doit jamais dépasser weeklyAvailableMinutes, sauf dans le sens de la réduction
  (semaines recovery/taper, volontairement plus basses).
- Si le gouverneur de charge interne est dégradé (🔴) ou le TSB très négatif, commence le plan par une ou
  deux semaines de charge réduite plutôt que d'attaquer fort immédiatement, et dis-le dans warnings.
- S'il y a une blessure active, adapte le contenu des premières semaines en conséquence et mentionne
  l'adaptation dans warnings.
- Si le plan est très court (moins de 4 semaines), simplifie : pas de vraie phase "base", concentre-toi sur
  l'affûtage et la spécificité, et dis-le dans warnings plutôt que d'inventer une périodisation classique
  qui ne tient pas dans le temps disponible.
- N'invente pas de données manquantes — travaille avec ce qui est fourni.

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme
(plus les champs de contrat obligatoires décrits plus haut — "summary" résume le plan en une phrase,
"recommendation" donne un conseil pour bien démarrer), et le tableau "weeks" doit contenir EXACTEMENT
${parsedInput.weekCount} éléments, dans l'ordre (semaine 1 en premier) :
{
  "planName": "nom court du plan",
  "weeks": [
    { "phase": "base|build|peak|taper|recovery", "focus": "une phrase courte", "targetWeeklyMinutes": nombre, "notes": "optionnel" }
  ],
  "warnings": ["0 à 3 points d'attention courts, tableau vide si rien à signaler"]
}`;

  return invokeCoachJson(TrainingPlanGenerationOutputSchema, {
    flowId: 'trainingPlanGeneration',
    taskSystemPrompt: system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    maxTokens: 8192,
  });
  } catch (e) {
    console.error('[trainingPlanGeneration] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
