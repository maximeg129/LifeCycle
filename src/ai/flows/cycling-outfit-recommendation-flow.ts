'use server';
/**
 * @fileOverview A cycling outfit recommendation AI agent that predicts weather based on location/time.
 *
 * - cyclingOutfitRecommendation - A function that handles the cycling outfit recommendation process.
 * - CyclingOutfitRecommendationInput - The input type for the cyclingOutfitRecommendation function.
 * - CyclingOutfitRecommendationOutput - The return type for the cyclingOutfitRecommendation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CyclingOutfitRecommendationInputSchema = z.object({
  location: z.string().describe('The name of the location (city, region, or coordinates).'),
  dateTime: z.string().describe('The date and time of the ride (e.g., "2024-05-24T09:00:00").'),
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
    temperatureCelsius: z.number().describe('Estimated average temperature during the ride.'),
    windSpeedKmh: z.number().describe('Estimated average wind speed.'),
    conditions: z.string().describe('Description of the weather conditions (e.g., "Soleil voilé", "Risque d\'averses").'),
    summary: z.string().describe('A short summary of the weather context for the ride.')
  }).describe('The weather forecast deduced by the AI for the specific location and time.'),
  recommendation: z.string().describe('Detailed textual recommendation for the cycling outfit.'),
  recommendedItems: z.array(z.string()).describe('List of names of specific clothing items recommended.')
}).describe('Output of the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationOutput = z.infer<typeof CyclingOutfitRecommendationOutputSchema>;

export async function cyclingOutfitRecommendation(input: CyclingOutfitRecommendationInput): Promise<CyclingOutfitRecommendationOutput> {
  return cyclingOutfitRecommendationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cyclingOutfitRecommendationPrompt',
  input: { schema: CyclingOutfitRecommendationInputSchema },
  output: { schema: CyclingOutfitRecommendationOutputSchema },
  prompt: `You are an expert cycling coach and meteorologist. 

Based on the provided location, date, and time, you must first act as a weather station to deduce the most likely weather conditions for that ride. Then, recommend the perfect cycling outfit from the user's inventory.

---
RIDE CONTEXT:
Location: {{{location}}}
Start Date/Time: {{{dateTime}}}
Expected Duration: {{{durationHours}}} hours

---
CLOTHING INVENTORY:
{{#each clothingInventory}}
- Name: {{{this.name}}}
  Type: {{{this.type}}}
  Temp Range: {{{this.temperatureRangeCelsius}}}
  Windproof: {{#if this.windproof}}Yes{{else}}No{{/if}}
  Waterproof: {{#if this.waterproof}}Yes{{else}}No{{/if}}
  Layer: {{{this.layer}}}
{{/each}}

---
YOUR TASK:
1. Predict the Weather: Determine temperature, wind speed, and conditions for this location and time. Be realistic based on seasonality and time of day.
2. Recommend the Outfit: Select the best items from the inventory. Explain why these layers are chosen based on your weather prediction.
3. Be specific: Only mention items in the 'clothingInventory'.

Recommendation:`
});

const cyclingOutfitRecommendationFlow = ai.defineFlow(
  {
    name: 'cyclingOutfitRecommendationFlow',
    inputSchema: CyclingOutfitRecommendationInputSchema,
    outputSchema: CyclingOutfitRecommendationOutputSchema
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
