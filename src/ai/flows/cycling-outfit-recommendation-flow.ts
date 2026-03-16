'use server';
/**
 * @fileOverview A cycling outfit recommendation AI agent that uses real-time weather data via tools.
 *
 * - cyclingOutfitRecommendation - A function that handles the cycling outfit recommendation process.
 * - CyclingOutfitRecommendationInput - The input type for the cyclingOutfitRecommendation function.
 * - CyclingOutfitRecommendationOutput - The return type for the cyclingOutfitRecommendation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
    temperatureCelsius: z.number().describe('Actual average temperature from weather API.'),
    windSpeedKmh: z.number().describe('Actual wind speed from weather API.'),
    conditions: z.string().describe('Description of the weather conditions (e.g., "Soleil", "Pluie").'),
    summary: z.string().describe('A short summary of the weather context for the ride.')
  }).describe('The real weather data fetched via API.'),
  recommendation: z.string().describe('Detailed textual recommendation for the cycling outfit.'),
  recommendedItems: z.array(z.string()).describe('List of names of specific clothing items recommended.')
}).describe('Output of the cycling outfit recommendation flow.');

export type CyclingOutfitRecommendationOutput = z.infer<typeof CyclingOutfitRecommendationOutputSchema>;

/**
 * Tool to fetch real weather data using Open-Meteo API.
 */
const getWeatherForecast = ai.defineTool(
  {
    name: 'getWeatherForecast',
    description: 'Fetches real weather forecast for a given location and date/time.',
    inputSchema: z.object({
      location: z.string().describe('City name or coordinates (lat,lon).'),
      dateTime: z.string().describe('ISO date-time string.'),
    }),
    outputSchema: z.object({
      temperature: z.number(),
      windSpeed: z.number(),
      weatherDescription: z.string(),
      error: z.string().optional(),
    }),
  },
  async (input) => {
    try {
      let lat, lon;
      
      // 1. Geocoding
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.location)}&count=1&language=fr&format=json`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        // Fallback if coordinates are provided directly
        const coords = input.location.split(',').map(c => parseFloat(c.trim()));
        if (coords.length === 2 && !isNaN(coords[0])) {
          lat = coords[0];
          lon = coords[1];
        } else {
          throw new Error('Location not found');
        }
      } else {
        lat = geoData.results[0].latitude;
        lon = geoData.results[0].longitude;
      }

      // 2. Weather Forecast
      const date = new Date(input.dateTime);
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m&forecast_days=14`;
      const weatherRes = await fetch(forecastUrl);
      const weatherData = await weatherRes.json();

      // Find the closest hour
      const targetTime = date.toISOString().slice(0, 13) + ':00';
      const timeIndex = weatherData.hourly.time.findIndex((t: string) => t.startsWith(targetTime.slice(0, 13)));
      
      const safeIndex = timeIndex === -1 ? 0 : timeIndex;

      // Weather codes mapping (simplified)
      const weatherCodes: Record<number, string> = {
        0: 'Ciel dégagé',
        1: 'Principalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
        45: 'Brouillard', 48: 'Brouillard givrant',
        51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
        61: 'Pluie faible', 63: 'Pluie modérée', 65: 'Pluie forte',
        71: 'Neige faible', 73: 'Neige modérée', 75: 'Neige forte',
        80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses violentes',
        95: 'Orage léger', 96: 'Orage avec grêle', 99: 'Orage violent'
      };

      return {
        temperature: weatherData.hourly.temperature_2m[safeIndex],
        windSpeed: weatherData.hourly.windspeed_10m[safeIndex],
        weatherDescription: weatherCodes[weatherData.hourly.weathercode[safeIndex]] || 'Conditions variables',
      };
    } catch (e: any) {
      return { temperature: 15, windSpeed: 10, weatherDescription: 'Erreur lors de la récupération des données réelles', error: e.message };
    }
  }
);

const prompt = ai.definePrompt({
  name: 'cyclingOutfitRecommendationPrompt',
  input: { schema: CyclingOutfitRecommendationInputSchema },
  output: { schema: CyclingOutfitRecommendationOutputSchema },
  tools: [getWeatherForecast],
  prompt: `You are an expert cycling coach. 

First, use the 'getWeatherForecast' tool to fetch the actual weather conditions for the provided location and time. 

Once you have the weather data:
1. Summarize the conditions (temp, wind, sky).
2. Recommend the perfect cycling outfit using ONLY items from the 'clothingInventory'.
3. Explain your choice based on the real weather data (e.g., "It's 12°C with wind, so the windproof jacket is essential").

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

Recommendation:`
});

export async function cyclingOutfitRecommendation(input: CyclingOutfitRecommendationInput): Promise<CyclingOutfitRecommendationOutput> {
  return cyclingOutfitRecommendationFlow(input);
}

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
