'use server';
/**
 * @fileOverview Generates a short recovery/training insight from the user's
 * recent wellness log (sleep, HRV, stress, mood) and, when available, their
 * cycling training load (CTL/ATL/TSB from Intervals.icu).
 *
 * - recoveryInsight - Runs the flow.
 * - RecoveryInsightInput / RecoveryInsightOutput - Types for the above.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RecoveryInsightInputSchema = z.object({
  dailyMetrics: z.array(z.object({
    date: z.string().describe('yyyy-MM-dd'),
    sleepHours: z.number().optional(),
    sleepQuality: z.number().optional().describe('0-100'),
    hrv: z.number().optional().describe('ms'),
    stressScore: z.number().optional().describe('0-100, lower is better'),
    mood: z.number().optional().describe('0-10'),
  })).describe('Last 7 days of wellness data, oldest first. Fields are absent where not logged.'),
  goals: z.array(z.object({
    label: z.string(),
    metric: z.string(),
    target: z.number(),
    direction: z.enum(['min', 'max']),
  })).optional().describe('User-defined wellness goals, if any.'),
  training: z.object({
    ctl: z.number().optional().describe('Chronic Training Load (fitness)'),
    atl: z.number().optional().describe('Acute Training Load (fatigue)'),
    tsb: z.number().optional().describe('Training Stress Balance (form) = ctl - atl'),
    rampRate: z.number().optional(),
  }).optional().describe('Cycling training load from Intervals.icu, if the user connected it.'),
}).describe('Input for the recovery insight flow.');

export type RecoveryInsightInput = z.infer<typeof RecoveryInsightInputSchema>;

const RecoveryInsightOutputSchema = z.object({
  summary: z.string().describe('One or two sentence overview of where the user stands right now.'),
  recommendation: z.string().describe('One concrete, actionable suggestion for today or the coming days (training intensity, rest, sleep, etc).'),
  highlights: z.array(z.string()).describe('1-3 short positive observations from the data. Empty array if none stand out.'),
  watchouts: z.array(z.string()).describe('1-3 short points worth watching or improving. Empty array if none stand out.'),
}).describe('Output of the recovery insight flow.');

export type RecoveryInsightOutput = z.infer<typeof RecoveryInsightOutputSchema>;

const prompt = ai.definePrompt({
  name: 'recoveryInsightPrompt',
  input: { schema: RecoveryInsightInputSchema },
  output: { schema: RecoveryInsightOutputSchema },
  prompt: `You are an expert endurance coach and sleep/recovery specialist speaking to a cyclist who also
tracks their sleep, HRV, stress and mood daily. Write your entire response in French.

Analyze the data below and produce a short, encouraging but honest recovery insight. Be specific and
reference actual numbers from the data when you can (e.g. "votre HRV moyen est de 62ms"). If a field is
missing across the board, don't invent it — just work with what's there. If dailyMetrics is mostly empty,
say so briefly and recommend logging a few more days rather than fabricating trends.

WELLNESS LOG (oldest first):
{{#each dailyMetrics}}
- {{{this.date}}}: sommeil {{#if this.sleepHours}}{{this.sleepHours}}h{{else}}n/a{{/if}}{{#if this.sleepQuality}} ({{this.sleepQuality}}% qualité){{/if}}, HRV {{#if this.hrv}}{{this.hrv}}ms{{else}}n/a{{/if}}, stress {{#if this.stressScore}}{{this.stressScore}}/100{{else}}n/a{{/if}}, humeur {{#if this.mood}}{{this.mood}}/10{{else}}n/a{{/if}}
{{/each}}

{{#if goals}}
GOALS (direction "min" = target is a minimum to reach, "max" = target is a ceiling not to exceed):
{{#each goals}}
- {{{this.label}}}: {{{this.metric}}}, target {{this.target}}, direction {{{this.direction}}}
{{/each}}
{{/if}}

{{#if training}}
CYCLING TRAINING LOAD:
CTL (fitness): {{#if training.ctl}}{{training.ctl}}{{else}}n/a{{/if}}
ATL (fatigue): {{#if training.atl}}{{training.atl}}{{else}}n/a{{/if}}
TSB (form): {{#if training.tsb}}{{training.tsb}}{{else}}n/a{{/if}}
{{/if}}

Respond with: a short summary, one concrete recommendation, up to 3 highlights, up to 3 watchouts.`,
});

export async function recoveryInsight(input: RecoveryInsightInput): Promise<RecoveryInsightOutput> {
  return recoveryInsightFlow(input);
}

const recoveryInsightFlow = ai.defineFlow(
  {
    name: 'recoveryInsightFlow',
    inputSchema: RecoveryInsightInputSchema,
    outputSchema: RecoveryInsightOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
