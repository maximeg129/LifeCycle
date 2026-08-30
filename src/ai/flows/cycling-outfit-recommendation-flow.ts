'use server';
/**
 * @fileOverview Recommends a cycling outfit from the athlete's clothing
 * inventory, grounded in the real weather forecast (Open-Meteo, via the
 * shared src/ai/weather.ts) for the exact location/date/time of the ride.
 *
 * Used to fetch the forecast via a Claude tool call (`get_weather_forecast`,
 * `tool_choice: 'auto'`) — the model *usually* called it, but nothing forced
 * it to, so a skipped tool call meant this flow could silently fall back to
 * an invented, plausible-sounding forecast instead of the real one (see
 * CLAUDE.md, and the "on se base sur des estimations" user report that
 * prompted this rewrite). Now mirrors dailyWorkoutRecommendation's already-
 * established pattern: the forecast is a deterministic pre-fetch the caller
 * always makes, never a decision left to the model — the same principle
 * documented for that flow, just not yet applied here when this one was
 * first written (it predates dailyWorkoutRecommendation).
 *
 * - cyclingOutfitRecommendation - A function that handles the cycling outfit recommendation process.
 * - CyclingOutfitRecommendationInput - The input type for the cyclingOutfitRecommendation function.
 * - CyclingOutfitRecommendationOutput - The return type for the cyclingOutfitRecommendation function.
 */

import { z } from 'zod';
import { generateJson, type FlowResult } from '@/ai/anthropic';
import { fetchWeatherForecast, degreesToCompass } from '@/ai/weather';

const CyclingOutfitRecommendationInputSchema = z.object({
  location: z.string().describe('The name of the location (city, region, or coordinates).'),
  dateTime: z.string().describe('The date and time of the ride (ISO format, e.g., "2024-05-24T09:00:00").'),
  durationHours: z.number().describe('Expected duration of the ride in hours.'),
  clothingInventory: z.array(z.object({
    name: z.string().describe('Name of the clothing item.'),
    type: z.string().describe('Type of clothing item.'),
    temperatureRangeCelsius: z.string().describe('Effective temperature range for the item.'),
    windproof: z.boolean().describe('True if the item is windproof.'),
    waterproof: z.boolean().describe('True if the item is waterproof.'),
    layer: z.string().describe('Layer type (base, mid, outer).')
  })).describe('List of available cycling clothing items in the user\'s inventory.')
}).describe('Input for the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationInput = z.infer<typeof CyclingOutfitRecommendationInputSchema>;

const CyclingOutfitRecommendationOutputSchema = z.object({
  predictedWeather: z.object({
    temperatureCelsius: z.number().describe('Real temperature from the Open-Meteo forecast.'),
    windSpeedKmh: z.number().describe('Real wind speed from the Open-Meteo forecast.'),
    windDirectionCompass: z.string().describe('French 8-point compass label for the direction the wind is blowing FROM, e.g. "Nord-Ouest".'),
    conditions: z.string().describe('Real weather conditions from the forecast (e.g. "Pluie modérée", "Ciel dégagé").'),
    summary: z.string().describe('A short summary of the weather context for the ride, in French — restate the real numbers given, never invent different ones.')
  }).describe('The real weather data fetched via Open-Meteo before this flow ever asked Claude anything — Claude only writes the summary, it never generates these numbers.'),
  recommendation: z.string().describe('Detailed textual recommendation for the cycling outfit.'),
  recommendedItems: z.array(z.string()).describe('List of names of specific clothing items recommended.')
}).describe('Output of the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationOutput = z.infer<typeof CyclingOutfitRecommendationOutputSchema>;

export async function cyclingOutfitRecommendation(input: CyclingOutfitRecommendationInput): Promise<FlowResult<CyclingOutfitRecommendationOutput>> {
  try {
  const parsedInput = CyclingOutfitRecommendationInputSchema.parse(input);

  // Real forecast, fetched unconditionally — never a tool call the model
  // could skip. A geocoding/API failure here means we genuinely don't have
  // real weather to ground a recommendation in, so this flow fails outright
  // (FlowResult error) rather than asking Claude to guess.
  const forecast = await fetchWeatherForecast(parsedInput.location, parsedInput.dateTime);
  if (forecast.error) {
    return { ok: false, error: `Impossible de récupérer la météo réelle pour "${parsedInput.location}" : ${forecast.error}` };
  }
  const windDirectionCompass = degreesToCompass(forecast.windDirectionDeg);

  const inventoryText = parsedInput.clothingInventory.map((item) =>
    `- ${item.name} (${item.type}, couche ${item.layer}) — plage ${item.temperatureRangeCelsius}, coupe-vent : ${item.windproof ? 'oui' : 'non'}, imperméable : ${item.waterproof ? 'oui' : 'non'}`
  ).join('\n');

  const system = `Tu es un coach cycliste expert. On te donne la météo RÉELLE (déjà récupérée via Open-Meteo, pas à toi de la deviner)
pour le lieu et l'heure de départ d'une sortie, ainsi que la garde-robe cycliste disponible.

Ta tâche :
1. Rédige un court bulletin météo (summary) en français reprenant les chiffres réels fournis ci-dessous —
   ne les modifie jamais, ne les arrondis pas différemment, ne les invente pas.
2. Recommande la tenue idéale en utilisant UNIQUEMENT des vêtements de la garde-robe fournie.
3. Justifie ton choix à partir de la météo réelle (ex. "12°C avec du vent, la veste coupe-vent est indispensable").

Réponds UNIQUEMENT avec un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme :
{
  "predictedWeather": {
    "temperatureCelsius": ${forecast.temperatureCelsius},
    "windSpeedKmh": ${forecast.windSpeedKmh},
    "windDirectionCompass": "${windDirectionCompass}",
    "conditions": "${forecast.conditions}",
    "summary": "bulletin météo court en français"
  },
  "recommendation": "recommandation textuelle détaillée",
  "recommendedItems": ["nom d'article de la garde-robe", ...]
}`;

  const userPrompt = `CONTEXTE DE LA SORTIE :
Lieu : ${parsedInput.location}
Départ : ${parsedInput.dateTime}
Durée prévue : ${parsedInput.durationHours} heures

MÉTÉO RÉELLE (Open-Meteo) :
Température : ${forecast.temperatureCelsius}°C
Vent : ${forecast.windSpeedKmh} km/h, venant du ${windDirectionCompass}
Conditions : ${forecast.conditions}

---
GARDE-ROBE DISPONIBLE :
${inventoryText}`;

  return generateJson(CyclingOutfitRecommendationOutputSchema, {
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
