'use server';
/**
 * @fileOverview Generates a short recovery/training insight from the user's
 * recent wellness log (sleep, HRV, stress, mood) and, when available, their
 * cycling training load (CTL/ATL/TSB from Intervals.icu).
 *
 * - recoveryInsight - Runs the flow.
 * - RecoveryInsightInput / RecoveryInsightOutput - Types for the above.
 */

import { z } from 'zod';
import { generateJson } from '@/ai/anthropic';

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
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the recovery insight flow.');

export type RecoveryInsightInput = z.infer<typeof RecoveryInsightInputSchema>;

const RecoveryInsightOutputSchema = z.object({
  summary: z.string().describe('One or two sentence overview of where the user stands right now.'),
  recommendation: z.string().describe('One concrete, actionable suggestion for today or the coming days (training intensity, rest, sleep, etc).'),
  highlights: z.array(z.string()).describe('1-3 short positive observations from the data. Empty array if none stand out.'),
  watchouts: z.array(z.string()).describe('1-3 short points worth watching or improving. Empty array if none stand out.'),
}).describe('Output of the recovery insight flow.');

export type RecoveryInsightOutput = z.infer<typeof RecoveryInsightOutputSchema>;

function formatMetricsLog(dailyMetrics: RecoveryInsightInput['dailyMetrics']): string {
  return dailyMetrics.map((m) => {
    const sleep = m.sleepHours ? `${m.sleepHours}h${m.sleepQuality ? ` (${m.sleepQuality}% qualité)` : ''}` : 'n/a';
    const hrv = m.hrv ? `${m.hrv}ms` : 'n/a';
    const stress = m.stressScore !== undefined ? `${m.stressScore}/100` : 'n/a';
    const mood = m.mood !== undefined ? `${m.mood}/10` : 'n/a';
    return `- ${m.date}: sommeil ${sleep}, HRV ${hrv}, stress ${stress}, humeur ${mood}`;
  }).join('\n');
}

export async function recoveryInsight(input: RecoveryInsightInput): Promise<RecoveryInsightOutput> {
  const parsedInput = RecoveryInsightInputSchema.parse(input);

  const sections: string[] = [`WELLNESS LOG (oldest first):\n${formatMetricsLog(parsedInput.dailyMetrics)}`];

  if (parsedInput.goals && parsedInput.goals.length > 0) {
    const goalsText = parsedInput.goals
      .map((g) => `- ${g.label}: ${g.metric}, target ${g.target}, direction ${g.direction}`)
      .join('\n');
    sections.push(`GOALS (direction "min" = target is a minimum to reach, "max" = target is a ceiling not to exceed):\n${goalsText}`);
  }

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CYCLING TRAINING LOAD:',
      `CTL (fitness): ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue): ${t.atl ?? 'n/a'}`,
      `TSB (form): ${t.tsb ?? 'n/a'}`,
    ].join('\n'));
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}You are an expert endurance coach and sleep/recovery specialist speaking to a cyclist who also
tracks their sleep, HRV, stress and mood daily. Write your entire response in French.

Analyze the data below and produce a short, encouraging but honest recovery insight. Be specific and
reference actual numbers from the data when you can (e.g. "votre HRV moyen est de 62ms"). If a field is
missing across the board, don't invent it — just work with what's there. If dailyMetrics is mostly empty,
say so briefly and recommend logging a few more days rather than fabricating trends.

Respond with ONLY a JSON object (no markdown fences, no other text) matching exactly this shape:
{
  "summary": "one or two sentence overview",
  "recommendation": "one concrete, actionable suggestion",
  "highlights": ["up to 3 short positive observations, empty array if none"],
  "watchouts": ["up to 3 short points worth watching, empty array if none"]
}`;

  return generateJson(RecoveryInsightOutputSchema, {
    system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
  });
}
