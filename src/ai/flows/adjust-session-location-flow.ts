'use server';
/**
 * @fileOverview Adapte le script structuré d'UNE séance déjà générée (une
 * séance type du plan, plan-week-sessions-flow.ts) pour un changement de
 * lieu intérieur/extérieur — retour utilisateur (chantier Frive/Join,
 * inspiré de Frive.io) : "la possibilité de modifier on the fly la séance
 * si on veut la réaliser en intérieur ou en extérieur (le contenu s'adapte
 * réellement)". Réutilise la MÊME adaptation home trainer déjà en place
 * pour dailyWorkoutRecommendation (HOME_TRAINER_ADAPTATION_GUIDANCE,
 * home-trainer-adaptation.ts) plutôt qu'une deuxième logique — c'est
 * exactement le même besoin physiologique, juste appliqué à une séance du
 * Plan plutôt qu'à la proposition du jour.
 *
 * Volontairement un flow à part, minimal, plutôt qu'une réutilisation de
 * dailyWorkoutRecommendation : ce dernier raisonne sur "aujourd'hui"
 * (récupération de la nuit, séances récentes, météo réelle) — inadapté à
 * une séance du Plan qui peut être datée n'importe quel jour de la
 * semaine. Un changement de lieu N'EST PAS une nouvelle décision
 * d'entraînement : durationMinutes/intensityLabel ne changent JAMAIS ici,
 * seulement sportType + structuredWorkout (+ une courte note
 * d'adaptation) — pas de contexte coach (mémoire/gouverneur/budget kJ) à
 * charger pour ça.
 *
 * - adjustSessionLocation - Runs the flow.
 * - AdjustSessionLocationInput / AdjustSessionLocationOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { STRUCTURED_WORKOUT_SYNTAX } from './structured-workout-syntax';
import { HOME_TRAINER_ADAPTATION_GUIDANCE } from './home-trainer-adaptation';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const AdjustSessionLocationInputSchema = z.object({
  title: z.string().describe('Titre actuel de la séance.'),
  durationMinutes: z.number().describe('Durée totale — ne doit JAMAIS changer, un changement de lieu n\'est pas une nouvelle décision d\'entraînement.'),
  intensityLabel: z.string().describe('Intensité cible actuelle (ex. "Seuil", "Endurance") — ne doit JAMAIS changer non plus.'),
  structuredWorkout: z.string().describe('Script structuré actuel (syntaxe workout-builder Intervals.icu) à adapter.'),
  targetLocation: z.enum(['indoor', 'outdoor']).describe('"indoor" = adapter pour un home trainer (sportType VirtualRide) ; "outdoor" = adapter pour rouler dehors (sportType Ride).'),
}).describe('Input for the session location adjustment flow.');

export type AdjustSessionLocationInput = z.infer<typeof AdjustSessionLocationInputSchema>;

const AdjustSessionLocationOutputSchema = withCoachOutputContract({
  sportType: z.enum(['Ride', 'VirtualRide']).describe('"VirtualRide" pour indoor, "Ride" pour outdoor — doit correspondre exactement à targetLocation.'),
  structuredWorkout: z.string().describe('Script structuré adapté, MÊME syntaxe, MÊME durée totale — jamais une simple copie inchangée du script d\'origine si le lieu change réellement l\'exécution (ex. home trainer : récupération explicite plutôt qu\'une roue libre en descente sous-entendue).'),
  adaptationNote: z.string().min(1).describe('1-2 phrases en français expliquant concrètement ce qui a changé dans le script — ou pourquoi rien n\'a dû changer, si le script d\'origine était déjà neutre au lieu (ex. un simple footing en Z1 sans étapes de récupération à ajuster).'),
}).describe('Output of the session location adjustment flow.');

export type AdjustSessionLocationOutput = z.infer<typeof AdjustSessionLocationOutputSchema>;

export async function adjustSessionLocation(input: AdjustSessionLocationInput): Promise<FlowResult<AdjustSessionLocationOutput>> {
  try {
    const parsedInput = AdjustSessionLocationInputSchema.parse(input);
    const isIndoor = parsedInput.targetLocation === 'indoor';

    const system = `Tu adaptes le script structuré d'UNE séance de vélo déjà planifiée pour un changement de lieu :
l'athlète va la faire ${isIndoor ? 'sur home trainer' : 'dehors'} plutôt que ${isIndoor ? 'dehors' : 'sur home trainer'} comme prévu à l'origine.

Règles impératives :
- La durée totale (${parsedInput.durationMinutes} minutes) et l'intensité cible (${parsedInput.intensityLabel}) ne changent JAMAIS — ce n'est pas une nouvelle décision d'entraînement, seulement une adaptation d'exécution au nouveau lieu.
- sportType doit être EXACTEMENT "${isIndoor ? 'VirtualRide' : 'Ride'}".
${isIndoor
  ? HOME_TRAINER_ADAPTATION_GUIDANCE
  : '- Séance extérieure : les phases de récupération peuvent redevenir implicites (roue libre, descente) — retire toute mention de "pédalage très léger obligatoire" ou de ventilateur/hydratation spécifique home trainer si le script d\'origine en portait, ces précisions n\'ont plus de sens dehors.'}
- Le script structuré adapté suit EXACTEMENT cette syntaxe (jamais un autre format) :
${STRUCTURED_WORKOUT_SYNTAX}
- Ne renomme le titre que si le nom actuel référence explicitement l'ancien lieu (ex. "Sortie extérieure" en passant à indoor) — sinon garde-le identique.

SÉANCE ACTUELLE À ADAPTER :
Titre : ${parsedInput.title}
Script structuré actuel :
${parsedInput.structuredWorkout}`;

    return await invokeCoachJson(AdjustSessionLocationOutputSchema, {
      flowId: 'sessionLocationAdjustment',
      taskSystemPrompt: system,
      messages: [{ role: 'user', content: `Adapte cette séance pour ${isIndoor ? 'un home trainer' : 'l\'extérieur'}.` }],
    });
  } catch (e) {
    console.error('[adjustSessionLocation] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
