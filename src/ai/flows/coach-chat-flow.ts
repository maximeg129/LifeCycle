'use server';
/**
 * @fileOverview Free-form conversational coach ("Stella") — unlike the
 * other flows in this app, this one returns plain text, not a JSON object.
 * Reuses buildCoachContext (same context block as recoveryInsight /
 * dailyWorkoutRecommendation / trainingPlanGeneration) so Stella's answers
 * are grounded in the same injuries/goals/lifestyle/governor/plan data as
 * every other coach feature, rather than a second, disconnected notion of
 * the athlete.
 *
 * Deliberately advisory only: Stella can discuss and suggest, but actually
 * generating a structured workout or a periodized plan and pushing it to
 * Intervals.icu stays the job of the dedicated "Proposition du jour" / "Plan"
 * tabs — see the system prompt below.
 *
 * - coachChat - Runs the flow.
 * - CoachChatInput / CoachChatMessage - Types for the above.
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, CLAUDE_MODEL } from '@/ai/anthropic';

const CoachChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export type CoachChatMessage = z.infer<typeof CoachChatMessageSchema>;

const CoachChatInputSchema = z.object({
  messages: z.array(CoachChatMessageSchema).min(1).describe('Conversation so far, oldest first, ending with the new user message.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
  training: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
  }).optional().describe('Current Intervals.icu training load, if connected.'),
  planWeek: z.object({
    weekNumber: z.number(),
    phase: z.string(),
    focus: z.string(),
    targetWeeklyMinutes: z.number(),
  }).optional().describe('The current week of the athlete\'s active training plan, if one exists.'),
  recovery: z.object({
    sleepHours: z.number().optional(),
    sleepQuality: z.number().optional().describe('0-100'),
    hrv: z.number().optional().describe('ms'),
    readiness: z.number().optional().describe('0-100'),
  }).optional().describe('Last night\'s sleep/HRV/readiness, auto-synced from Intervals.icu (or manually logged).'),
}).describe('Input for the coach chat flow.');

export type CoachChatInput = z.infer<typeof CoachChatInputSchema>;

export async function coachChat(input: CoachChatInput): Promise<string> {
  const parsedInput = CoachChatInputSchema.parse(input);

  const contextLines: string[] = [];
  if (parsedInput.training) {
    const t = parsedInput.training;
    contextLines.push(`FORME ACTUELLE (Intervals.icu) : CTL ${t.ctl ?? 'n/a'}, ATL ${t.atl ?? 'n/a'}, TSB ${t.tsb ?? 'n/a'}`);
  }
  if (parsedInput.planWeek) {
    const w = parsedInput.planWeek;
    contextLines.push(`PLAN EN COURS : semaine ${w.weekNumber}, phase ${w.phase} — ${w.focus} (volume cible ${w.targetWeeklyMinutes} min)`);
  }
  if (parsedInput.recovery) {
    const r = parsedInput.recovery;
    contextLines.push(`RÉCUPÉRATION (nuit dernière) : sommeil ${r.sleepHours != null ? `${r.sleepHours}h` : 'n/a'}${r.sleepQuality != null ? ` (${r.sleepQuality}%)` : ''}, HRV ${r.hrv != null ? `${r.hrv}ms` : 'n/a'}, readiness ${r.readiness != null ? `${r.readiness}/100` : 'n/a'}`);
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';
  const liveContextBlock = contextLines.length > 0 ? `${contextLines.join('\n')}\n\n` : '';

  const system = `${coachContextBlock}${liveContextBlock}Tu es Stella, la coach cycliste IA de l'utilisateur dans l'application LifeCycle Pro. Tu connais son
historique, ses objectifs, ses blessures et sa forme actuelle grâce au contexte ci-dessus — utilise-le
activement dans tes réponses plutôt que de rester générique.

Ton, style :
- Réponds toujours en français, sur un ton direct et chaleureux, comme une coach qui connaît vraiment
  l'athlète — pas un chatbot générique.
- Sois concise par défaut (quelques phrases) ; développe seulement si la question l'exige ou si on te le
  demande explicitement.
- Si une donnée pertinente manque (ex: pas de blessure enregistrée, pas de plan actif), dis-le simplement
  plutôt que d'inventer.
- Si on te parle d'entraînement du jour et que la récupération (sommeil/HRV/readiness) est mauvaise,
  dis-le franchement et conseille de lever le pied — ne reste pas focalisé uniquement sur la charge
  d'entraînement en ignorant l'état de récupération réel.

Limites importantes :
- Tu peux discuter d'une séance, donner un avis, expliquer un choix — mais tu ne génères PAS toi-même de
  séance structurée à envoyer sur Intervals.icu ni de plan d'entraînement complet : ce sont les onglets
  dédiés "Proposition du jour" et "Plan" qui font ça, avec un format précis. Si on te demande une séance du
  jour ou un plan complet, réponds normalement sur le fond (ex: donne une idée générale) mais renvoie vers
  ces onglets pour la version structurée envoyable.
- Tu n'as pas accès à des informations médicales au-delà de ce que l'utilisateur a lui-même renseigné dans
  Coach Mémoire — pour une vraie blessure ou douleur, rappelle de consulter un professionnel de santé.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system,
    messages: parsedInput.messages.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content })),
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) throw new Error('Claude did not return a text response');
  return textBlock.text;
}
