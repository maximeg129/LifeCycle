'use server';
/**
 * @fileOverview Proposes a single concrete workout for today, sized to the
 * time the athlete actually has available and adapted to their current form
 * (internal load governor, CTL/ATL/TSB, recent sessions) and Coach Memory
 * (injuries, goals, lifestyle). Output includes an Intervals.icu
 * workout-builder step script, ready to push to the calendar via
 * createPlannedWorkout() (see src/lib/intervals-api.ts).
 *
 * - dailyWorkoutRecommendation - Runs the flow.
 * - DailyWorkoutRecommendationInput / DailyWorkoutRecommendationOutput - Types for the above.
 */

import { z } from 'zod';
import { generateJson } from '@/ai/anthropic';

const DailyWorkoutRecommendationInputSchema = z.object({
  date: z.string().describe('yyyy-MM-dd — the day this workout is planned for.'),
  availableMinutes: z.number().describe('Minutes the athlete actually has available today, including warmup/cooldown.'),
  sportType: z.string().optional().describe('Preferred Intervals.icu sport type (e.g. "Ride", "VirtualRide"). Defaults to "Ride".'),
  training: z.object({
    ctl: z.number().optional().describe('Chronic Training Load (fitness)'),
    atl: z.number().optional().describe('Acute Training Load (fatigue)'),
    tsb: z.number().optional().describe('Training Stress Balance (form) = ctl - atl'),
    rampRate: z.number().optional(),
  }).optional().describe('Current Intervals.icu training load, if connected.'),
  recentSessions: z.array(z.object({
    date: z.string().describe('yyyy-MM-dd'),
    type: z.string().optional(),
    durationMinutes: z.number().optional(),
    trainingLoad: z.number().optional(),
  })).describe('Last ~7 days of completed sessions, oldest first. Empty array if none.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the daily workout recommendation flow.');

export type DailyWorkoutRecommendationInput = z.infer<typeof DailyWorkoutRecommendationInputSchema>;

const DailyWorkoutRecommendationOutputSchema = z.object({
  title: z.string().describe('Short workout name, e.g. "Endurance 90min" or "Seuil 4x8min".'),
  sportType: z.string().describe('Intervals.icu sport type this workout is for, e.g. "Ride".'),
  durationMinutes: z.number().describe('Total planned duration including warmup/cooldown — must not exceed availableMinutes.'),
  intensityLabel: z.string().describe('One or two words describing the session, e.g. "Endurance", "Seuil", "Récupération active".'),
  rationale: z.string().describe('2-4 sentences in French explaining why this session fits today, grounded in the actual form/context data provided — not generic advice.'),
  structuredWorkout: z.string().describe('Intervals.icu workout-builder step script, one instruction per line (see system prompt for the exact syntax).'),
  warnings: z.array(z.string()).describe('0-3 short things the athlete should know before starting (injury caution, heavy week, etc). Empty array if nothing stands out.'),
}).describe('Output of the daily workout recommendation flow.');

export type DailyWorkoutRecommendationOutput = z.infer<typeof DailyWorkoutRecommendationOutputSchema>;

function formatRecentSessions(sessions: DailyWorkoutRecommendationInput['recentSessions']): string {
  if (sessions.length === 0) return '- Aucune séance enregistrée récemment.';
  return sessions.map((s) => {
    const type = s.type || 'séance';
    const duration = s.durationMinutes != null ? `${s.durationMinutes}min` : 'durée inconnue';
    const load = s.trainingLoad != null ? `, charge ${Math.round(s.trainingLoad)}` : '';
    return `- ${s.date}: ${type}, ${duration}${load}`;
  }).join('\n');
}

export async function dailyWorkoutRecommendation(input: DailyWorkoutRecommendationInput): Promise<DailyWorkoutRecommendationOutput> {
  const parsedInput = DailyWorkoutRecommendationInputSchema.parse(input);

  const sections: string[] = [
    `DATE DE LA SÉANCE : ${parsedInput.date}`,
    `TEMPS DISPONIBLE : ${parsedInput.availableMinutes} minutes (échauffement et retour au calme inclus)`,
    `SPORT PRÉFÉRÉ : ${parsedInput.sportType || 'Ride'}`,
  ];

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CHARGE D\'ENTRAÎNEMENT (Intervals.icu) :',
      `CTL (fitness) : ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue) : ${t.atl ?? 'n/a'}`,
      `TSB (forme) : ${t.tsb ?? 'n/a'}`,
      `Ramp rate : ${t.rampRate ?? 'n/a'}`,
    ].join('\n'));
  }

  sections.push(`SÉANCES RÉCENTES (7 derniers jours, du plus ancien au plus récent) :\n${formatRecentSessions(parsedInput.recentSessions)}`);

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach cycliste expert. À partir du contexte fourni (forme actuelle, charge d'entraînement,
blessures, objectifs, style de vie, séances récentes), propose UNE séance concrète et réalisable aujourd'hui,
qui tienne dans le temps disponible.

Règles impératives :
- La durée totale proposée (durationMinutes) ne doit JAMAIS dépasser le temps disponible.
- Si le gouverneur de charge interne est dégradé (🔴) ou si le TSB est très négatif, propose une séance
  d'intensité réduite (endurance ou récupération active) plutôt qu'une séance à haute intensité, et dis-le
  explicitement dans rationale.
- S'il y a une blessure active, adapte ou évite ce qui pourrait l'aggraver, et mentionne l'adaptation dans warnings.
- S'il y a un objectif proche avec une priorité haute, oriente le contenu de la séance vers sa spécificité
  (ex: un objectif "grimpeur" appelle du travail en côte ou en seuil, pas uniquement de l'endurance plate).
- N'invente pas de données manquantes — travaille avec ce qui est fourni.

Format du script structuré (structuredWorkout), en syntaxe Intervals.icu (une instruction par ligne) :
- Une étape simple : "<durée> <cible>% <nom optionnel>", ex. "15m 55-65% Échauffement"
- Un bloc répété : "<N>x (<durée> <cible>% / <durée> <cible>%)", ex. "4x (5m 95-105% / 3m 50%)"
- Les cibles sont exprimées en % de la FTP (puissance seuil), jamais en watts absolus.
- Termine toujours par un retour au calme.

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme :
{
  "title": "nom court de la séance",
  "sportType": "type Intervals.icu, ex. Ride",
  "durationMinutes": nombre,
  "intensityLabel": "un ou deux mots",
  "rationale": "2 à 4 phrases justifiant ce choix à partir du contexte réel fourni",
  "structuredWorkout": "script structuré, une instruction par ligne",
  "warnings": ["0 à 3 points d'attention courts, tableau vide si rien à signaler"]
}`;

  return generateJson(DailyWorkoutRecommendationOutputSchema, {
    system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
  });
}
