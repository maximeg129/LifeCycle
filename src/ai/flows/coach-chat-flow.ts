'use server';
/**
 * @fileOverview Free-form conversational coach ("Stella"). Unlike the other
 * flows in this app, most of its replies are plain text, not a JSON object —
 * but it also has a small, deliberately narrow set of tools to actually
 * apply the Coach Memory changes a user asks for in conversation ("mets à
 * jour mon objectif à telle date", "note que je préfère les sorties le
 * matin") instead of only ever discussing them and pointing at another tab.
 * Reuses buildCoachContext (same context block as recoveryInsight /
 * dailyWorkoutRecommendation / trainingPlanGeneration) so Stella's answers
 * are grounded in the same injuries/goals/lifestyle/governor/plan data as
 * every other coach feature, rather than a second, disconnected notion of
 * the athlete.
 *
 * Tool execution itself can't happen here: this flow runs server-side with
 * no authenticated Firestore client (every write in this app goes through
 * the browser's Firebase client SDK — see CLAUDE.md). So a tool call comes
 * back to the caller as a `{ type: 'tool_use' }` result instead of text;
 * use-coach-chat.ts executes the actual Firestore write, then calls this
 * flow again with `pendingToolRound` (the assistant's tool_use content
 * echoed back, plus the tool's result) to get Claude's follow-up — same
 * shape as a standard Anthropic tool-use loop, just with the "executor"
 * living on the client instead of inside this function.
 *
 * Deliberately still advisory-only for anything precision-formatted:
 * generating a structured workout or a periodized plan and pushing it to
 * Intervals.icu stays the job of the dedicated "Proposition du jour" / "Plan"
 * tabs — see the system prompt below. Only the small, low-risk Coach Memory
 * writes below get tools; deleting a goal/injury is deliberately NOT exposed
 * here (a stray chat message shouldn't be able to silently delete data) —
 * that stays a Coach Mémoire tab action.
 *
 * - coachChat - Runs the flow.
 * - CoachChatInput / CoachChatMessage / CoachChatOutput - Types for the above.
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { type FlowResult } from '@/ai/anthropic';
import { invokeCoachConversational } from '@/ai/coach/invokeCoach';

const CoachChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export type CoachChatMessage = z.infer<typeof CoachChatMessageSchema>;

const CoachChatToolRoundSchema = z.object({
  /** The assistant turn's raw content blocks (text + tool_use) from the previous coachChat() call, echoed back verbatim so Claude sees its own tool call in context. */
  assistantContent: z.array(z.record(z.string(), z.unknown())),
  toolResults: z.array(z.object({
    toolUseId: z.string(),
    content: z.string(),
    isError: z.boolean().optional(),
  })),
});

const CoachChatInputSchema = z.object({
  messages: z.array(CoachChatMessageSchema).min(1).describe('Conversation so far, oldest first, ending with the new user message.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
  training: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
    ftp: z.number().optional().describe('Functional Threshold Power (W), from Intervals.icu.'),
    weightKg: z.number().optional().describe('Athlete weight (kg), from Intervals.icu.'),
  }).optional().describe('Current Intervals.icu training load and physiological reference values, if connected.'),
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
  availableGoals: z.array(z.object({
    id: z.string(),
    eventName: z.string(),
    eventDate: z.string(),
    targetOutcome: z.string(),
    priority: z.number(),
  })).optional().describe('The athlete\'s current goals with their Firestore ids, so update_goal can target the right one.'),
  availableInjuries: z.array(z.object({
    id: z.string(),
    bodyRegion: z.string(),
    status: z.enum(['active', 'resolved']),
  })).optional().describe('The athlete\'s current injuries with their Firestore ids, so update_injury_status can target the right one.'),
  /** Set only when continuing a turn after the caller executed a tool call — see the file header comment. */
  pendingToolRound: CoachChatToolRoundSchema.optional(),
}).describe('Input for the coach chat flow.');

export type CoachChatInput = z.infer<typeof CoachChatInputSchema>;

export interface CoachChatToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export type CoachChatOutput =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; assistantContent: Anthropic.ContentBlock[]; calls: CoachChatToolCall[] }

const updateGoalTool: Anthropic.Tool = {
  name: 'update_goal',
  description: "Met à jour un ou plusieurs champs d'un objectif existant (nom, date, résultat visé, priorité). N'envoie que les champs qui changent. Utilise l'id exact fourni dans OBJECTIFS DISPONIBLES ci-dessus — jamais un id inventé.",
  input_schema: {
    type: 'object',
    properties: {
      goalId: { type: 'string' },
      eventName: { type: 'string' },
      eventDate: { type: 'string', description: 'yyyy-MM-dd' },
      targetOutcome: { type: 'string' },
      priority: { type: 'number', description: '1 (prioritaire) à 3 (optionnel)' },
    },
    required: ['goalId'],
  },
};

const addGoalTool: Anthropic.Tool = {
  name: 'add_goal',
  description: "Ajoute un nouvel objectif à venir pour l'athlète.",
  input_schema: {
    type: 'object',
    properties: {
      eventName: { type: 'string' },
      eventDate: { type: 'string', description: 'yyyy-MM-dd' },
      targetOutcome: { type: 'string' },
      priority: { type: 'number', description: '1 (prioritaire) à 3 (optionnel)' },
    },
    required: ['eventName', 'eventDate', 'targetOutcome', 'priority'],
  },
};

const addRememberedFactTool: Anthropic.Tool = {
  name: 'add_remembered_fact',
  description: "Ajoute un fait à retenir durablement sur l'athlète (préférence, contrainte, habitude...) à la mémoire coach.",
  input_schema: {
    type: 'object',
    properties: { fact: { type: 'string' } },
    required: ['fact'],
  },
};

const updateInjuryStatusTool: Anthropic.Tool = {
  name: 'update_injury_status',
  description: "Change le statut d'une blessure existante (active ou résolue). Utilise l'id exact fourni dans BLESSURES DISPONIBLES ci-dessus — jamais un id inventé.",
  input_schema: {
    type: 'object',
    properties: {
      injuryId: { type: 'string' },
      status: { type: 'string', enum: ['active', 'resolved'] },
    },
    required: ['injuryId', 'status'],
  },
};

const setStrengthTrainingPreferenceTool: Anthropic.Tool = {
  name: 'set_strength_training_preference',
  description:
    "Active ou désactive la préférence \"inclure des séances de musculation\" pour les FUTURS plans " +
    "d'entraînement, et ajuste éventuellement le volume hebdo dédié. N'écrit JAMAIS dans un plan déjà généré " +
    "(tu ne modifies ni ne régénères aucun plan toi-même) — la préférence s'applique à la PROCHAINE " +
    "génération, l'athlète devra régénérer son plan (onglet Plan) pour qu'un plan déjà actif en tienne compte.",
  input_schema: {
    type: 'object',
    properties: {
      includeStrengthTraining: { type: 'boolean' },
      strengthWeeklyMinutes: { type: 'number', description: 'Volume musculation hebdo souhaité, en minutes — optionnel.' },
    },
    required: ['includeStrengthTraining'],
  },
};

const COACH_TOOLS: Anthropic.Tool[] = [updateGoalTool, addGoalTool, addRememberedFactTool, updateInjuryStatusTool, setStrengthTrainingPreferenceTool];

export async function coachChat(input: CoachChatInput): Promise<FlowResult<CoachChatOutput>> {
  try {
  const parsedInput = CoachChatInputSchema.parse(input);

  const contextLines: string[] = [];
  if (parsedInput.training) {
    const t = parsedInput.training;
    contextLines.push(`FORME ACTUELLE (Intervals.icu) : CTL ${t.ctl ?? 'n/a'}, ATL ${t.atl ?? 'n/a'}, TSB ${t.tsb ?? 'n/a'}, FTP ${t.ftp != null ? `${t.ftp}W` : 'n/a'}, Poids ${t.weightKg != null ? `${t.weightKg}kg` : 'n/a'}`);
  }
  if (parsedInput.planWeek) {
    const w = parsedInput.planWeek;
    contextLines.push(`PLAN EN COURS : semaine ${w.weekNumber}, phase ${w.phase} — ${w.focus} (volume cible ${w.targetWeeklyMinutes} min)`);
  }
  if (parsedInput.recovery) {
    const r = parsedInput.recovery;
    contextLines.push(`RÉCUPÉRATION (nuit dernière) : sommeil ${r.sleepHours != null ? `${r.sleepHours}h` : 'n/a'}${r.sleepQuality != null ? ` (${r.sleepQuality}%)` : ''}, HRV ${r.hrv != null ? `${r.hrv}ms` : 'n/a'}, readiness ${r.readiness != null ? `${r.readiness}/100` : 'n/a'}`);
  }
  if (parsedInput.availableGoals) {
    contextLines.push(parsedInput.availableGoals.length > 0
      ? `OBJECTIFS DISPONIBLES (id à utiliser tel quel avec update_goal) :\n${parsedInput.availableGoals.map((g) => `- [${g.id}] ${g.eventName} (${g.eventDate}, priorité ${g.priority}) : ${g.targetOutcome}`).join('\n')}`
      : 'OBJECTIFS DISPONIBLES : aucun.');
  }
  if (parsedInput.availableInjuries) {
    contextLines.push(parsedInput.availableInjuries.length > 0
      ? `BLESSURES DISPONIBLES (id à utiliser tel quel avec update_injury_status) :\n${parsedInput.availableInjuries.map((i) => `- [${i.id}] ${i.bodyRegion} (${i.status === 'active' ? 'active' : 'résolue'})`).join('\n')}`
      : 'BLESSURES DISPONIBLES : aucune.');
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';
  const liveContextBlock = contextLines.length > 0 ? `${contextLines.join('\n')}\n\n` : '';

  const system = `${coachContextBlock}${liveContextBlock}Tu es Stella, la coach cycliste IA de l'utilisateur dans l'application LifeCycle Pro. Tu connais son
historique, ses objectifs, ses blessures et sa forme actuelle grâce au contexte ci-dessus — utilise-le
activement dans tes réponses plutôt que de rester générique. Le contexte indique la date d'aujourd'hui
(AUJOURD'HUI) — base tout raisonnement relatif à une date ("dans combien de temps", "cette semaine") sur
cette date-là, jamais sur une supposition.

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

Actions que tu peux réellement effectuer (via les outils fournis) :
- Mettre à jour ou ajouter un objectif, ajouter un fait à retenir, changer le statut d'une blessure —
  quand l'utilisateur te le demande explicitement (ex: "change la date de mon objectif au 12 mai",
  "note que je préfère rouler le matin", "ma blessure au genou est guérie"). Utilise l'outil approprié
  plutôt que de simplement dire que tu l'as fait — sans appel d'outil, rien n'est réellement enregistré.
- Activer/désactiver la musculation en complément du plan (ex: "j'aimerais des séances de musculation
  dans mon plan", "enlève la musculation") — utilise set_strength_training_preference. Précise bien dans
  ta réponse que ça s'applique au PROCHAIN plan généré/régénéré, pas au plan actuel s'il y en a déjà un
  actif (renvoie vers l'onglet Plan pour régénérer).
- Si la demande est ambiguë (plusieurs objectifs possibles, information manquante), pose une question de
  clarification au lieu de deviner ou d'appeler un outil avec un id incertain.
- Après un appel d'outil réussi, confirme brièvement ce qui a été changé dans ta réponse suivante.
- Tu ne peux PAS supprimer un objectif ou une blessure depuis la conversation — oriente vers l'onglet
  "Mémoire coach" pour une suppression.

Limites importantes :
- Tu peux discuter d'une séance, donner un avis, expliquer un choix — mais tu ne génères PAS toi-même de
  séance structurée à envoyer sur Intervals.icu ni de plan d'entraînement complet : ce sont les onglets
  dédiés "Proposition du jour" et "Plan" qui font ça, avec un format précis. Si on te demande une séance du
  jour ou un plan complet, réponds normalement sur le fond (ex: donne une idée générale) mais renvoie vers
  ces onglets pour la version structurée envoyable.
- Tu n'as pas accès à des informations médicales au-delà de ce que l'utilisateur a lui-même renseigné dans
  Coach Mémoire — pour une vraie blessure ou douleur, rappelle de consulter un professionnel de santé.`;

  const messages: Anthropic.MessageParam[] = parsedInput.messages.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content }));

  if (parsedInput.pendingToolRound) {
    messages.push({ role: 'assistant', content: parsedInput.pendingToolRound.assistantContent as unknown as Anthropic.ContentBlock[] });
    messages.push({
      role: 'user',
      content: parsedInput.pendingToolRound.toolResults.map((r): Anthropic.ToolResultBlockParam => ({
        type: 'tool_result',
        tool_use_id: r.toolUseId,
        content: r.content,
        is_error: r.isError,
      })),
    });
  }

  const result = await invokeCoachConversational({
    flowId: 'coachChat',
    taskSystemPrompt: system,
    tools: COACH_TOOLS,
    messages,
    maxTokens: 1024,
  });
  if (!result.ok) return result;
  const { stopReason, content } = result.data;

  if (stopReason === 'tool_use') {
    const calls: CoachChatToolCall[] = content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));
    return { ok: true, data: { type: 'tool_use', assistantContent: content, calls } };
  }

  const textBlock = content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) return { ok: false, error: "Claude n'a renvoyé aucun texte." };
  return { ok: true, data: { type: 'text', text: textBlock.text } };
  } catch (e) {
    console.error('[coachChat] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
