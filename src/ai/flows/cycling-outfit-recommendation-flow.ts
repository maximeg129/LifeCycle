'use server';
/**
 * @fileOverview A cycling outfit recommendation AI agent that uses real-time weather data via tools.
 *
 * - cyclingOutfitRecommendation - A function that handles the cycling outfit recommendation process.
 * - CyclingOutfitRecommendationInput - The input type for the cyclingOutfitRecommendation function.
 * - CyclingOutfitRecommendationOutput - The return type for the cyclingOutfitRecommendation function.
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, CLAUDE_MODEL } from '@/ai/anthropic';
import { fetchWeatherForecast } from '@/ai/weather';

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

interface WeatherToolResult {
  temperature: number;
  windSpeed: number;
  weatherDescription: string;
  error?: string;
}

/** Thin adapter over the shared fetchWeatherForecast() (src/ai/weather.ts) — keeps this tool's result shape exactly as before (temperature/windSpeed/weatherDescription) for the model. */
async function getWeatherForecast(location: string, dateTime: string): Promise<WeatherToolResult> {
  const forecast = await fetchWeatherForecast(location, dateTime);
  return {
    temperature: forecast.temperatureCelsius,
    windSpeed: forecast.windSpeedKmh,
    weatherDescription: forecast.conditions,
    ...(forecast.error ? { error: forecast.error } : {}),
  };
}

const weatherTool: Anthropic.Tool = {
  name: 'get_weather_forecast',
  description: 'Fetches the real weather forecast for a given location and date/time.',
  input_schema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name or coordinates (lat,lon).' },
      dateTime: { type: 'string', description: 'ISO date-time string.' },
    },
    required: ['location', 'dateTime'],
  },
};

export async function cyclingOutfitRecommendation(input: CyclingOutfitRecommendationInput): Promise<CyclingOutfitRecommendationOutput> {
  const parsedInput = CyclingOutfitRecommendationInputSchema.parse(input);

  const inventoryText = parsedInput.clothingInventory.map((item) =>
    `- Name: ${item.name}\n  Type: ${item.type}\n  Temp Range: ${item.temperatureRangeCelsius}\n  Windproof: ${item.windproof ? 'Yes' : 'No'}\n  Waterproof: ${item.waterproof ? 'Yes' : 'No'}\n  Layer: ${item.layer}`
  ).join('\n');

  const system = `You are an expert cycling coach.

First, use the 'get_weather_forecast' tool to fetch the actual weather conditions for the provided location and time.

Once you have the weather data:
1. Summarize the conditions (temp, wind, sky).
2. Recommend the perfect cycling outfit using ONLY items from the clothing inventory.
3. Explain your choice based on the real weather data (e.g., "It's 12°C with wind, so the windproof jacket is essential").

When you have everything you need, respond with ONLY a JSON object (no markdown fences, no other text, no tool call) matching exactly this shape:
{
  "predictedWeather": { "temperatureCelsius": number, "windSpeedKmh": number, "conditions": "string", "summary": "string" },
  "recommendation": "detailed textual recommendation",
  "recommendedItems": ["item name from inventory", ...]
}`;

  const userPrompt = `RIDE CONTEXT:
Location: ${parsedInput.location}
Start Date/Time: ${parsedInput.dateTime}
Expected Duration: ${parsedInput.durationHours} hours

---
CLOTHING INVENTORY:
${inventoryText}`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  let response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system,
    tools: [weatherTool],
    messages,
  });

  // Manual tool-use loop — the model calls get_weather_forecast at most once in practice.
  let toolRounds = 0;
  while (response.stop_reason === 'tool_use' && toolRounds < 3) {
    toolRounds++;
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.name === 'get_weather_forecast') {
        const toolInput = block.input as { location: string; dateTime: string };
        const result = await getWeatherForecast(toolInput.location, toolInput.dateTime);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool', is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      tools: [weatherTool],
      messages,
    });
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('Claude did not return a final text response');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON object found in Claude response: ${textBlock.text.slice(0, 200)}`);

  return CyclingOutfitRecommendationOutputSchema.parse(JSON.parse(jsonMatch[0]));
}
