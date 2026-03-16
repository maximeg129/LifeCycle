'use server';
/**
 * @fileOverview A cycling outfit recommendation AI agent.
 *
 * - cyclingOutfitRecommendation - A function that handles the cycling outfit recommendation process.
 * - CyclingOutfitRecommendationInput - The input type for the cyclingOutfitRecommendation function.
 * - CyclingOutfitRecommendationOutput - The return type for the cyclingOutfitRecommendation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CyclingOutfitRecommendationInputSchema = z.object({
  location: z.string().optional().describe('The name of the location (city, region).'),
  currentWeather: z.object({
    temperatureCelsius: z.number().describe('Current or forecast temperature in Celsius.'),
    windSpeedKmh: z.number().describe('Current or forecast wind speed in kilometers per hour.'),
    precipitation: z.string().describe('Current or forecast precipitation type and intensity (e.g., "none", "light rain", "heavy rain", "snow").'),
    durationHours: z.number().describe('Expected duration of the ride in hours.')
  }).describe('Current or forecast weather conditions for the cycling ride.'),
  clothingInventory: z.array(z.object({
    name: z.string().describe('Name of the clothing item (e.g., "Maillot thermique Castelli", "Gilet coupe-vent Rapha").'),
    type: z.string().describe('Type of clothing item (e.g., "baselayer", "jersey", "jacket", "bib shorts", "tights", "gloves", "hat", "shoes", "shoe covers").'),
    temperatureRangeCelsius: z.string().describe('Effective temperature range for the item (e.g., "5-15°C", "-5-5°C").'),
    windproof: z.boolean().describe('True if the item is windproof.'),
    waterproof: z.boolean().describe('True if the item is waterproof.'),
    layer: z.string().describe('Layer type (e.g., "base", "mid", "outer").')
  })).describe('List of available cycling clothing items in the user\'s inventory.')
}).describe('Input for the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationInput = z.infer<typeof CyclingOutfitRecommendationInputSchema>;

const CyclingOutfitRecommendationOutputSchema = z.object({
  recommendation: z.string().describe('A detailed textual recommendation for the cycling outfit, explaining the choices based on weather and inventory.'),
  recommendedItems: z.array(z.string()).describe('A list of names of specific clothing items recommended from the provided inventory.')
}).describe('Output of the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationOutput = z.infer<typeof CyclingOutfitRecommendationOutputSchema>;

export async function cyclingOutfitRecommendation(input: CyclingOutfitRecommendationInput): Promise<CyclingOutfitRecommendationOutput> {
  return cyclingOutfitRecommendationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cyclingOutfitRecommendationPrompt',
  input: { schema: CyclingOutfitRecommendationInputSchema },
  output: { schema: CyclingOutfitRecommendationOutputSchema },
  prompt: `You are an expert cycling coach and clothing specialist. Your goal is to provide a personalized cycling outfit recommendation based on the current weather conditions, the location, and the cyclist's clothing inventory.

Analyze the provided weather conditions and the cyclist's available clothing items. Select the most appropriate items from the inventory to ensure the cyclist is comfortable and well-protected for their ride.

Location context: {{#if location}}{{{location}}}{{else}}Unknown{{/if}}

Pay close attention to:
- Temperature: Select items with suitable temperature ranges.
- Wind: Prioritize windproof items if wind speed is high.
- Precipitation: Prioritize waterproof items if there is rain or snow.
- Duration: Consider the duration of the ride for comfort and potential weather changes.
- Layers: Suggest appropriate layering based on the conditions.

Provide a detailed textual recommendation explaining your choices and a list of the names of the recommended items. Only recommend items that are explicitly listed in the 'clothingInventory'. If no suitable item is found for a specific condition, mention that.

---
Weather Conditions:
Temperature: {{{currentWeather.temperatureCelsius}}}°C
Wind Speed: {{{currentWeather.windSpeedKmh}}} km/h
Precipitation: {{{currentWeather.precipitation}}}
Expected Duration: {{{currentWeather.durationHours}}} hours

---
Clothing Inventory:
{{#each clothingInventory}}
- Name: {{{this.name}}}
  Type: {{{this.type}}}
  Temperature Range: {{{this.temperatureRangeCelsius}}}
  Windproof: {{#if this.windproof}}Yes{{else}}No{{/if}}
  Waterproof: {{#if this.waterproof}}Yes{{else}}No{{/if}}
  Layer: {{{this.layer}}}
{{/each}}
---

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
