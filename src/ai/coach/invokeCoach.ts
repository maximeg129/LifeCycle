'use server'
// ── Point d'entrée unique vers le modèle pour le coach IA ──────────────────
//
// Exigence du cadrage : "aucun chemin de code ne peut appeler le modèle sauf
// via l'assembleur de prompt unique. Le prompt assemblé est versionné, et le
// version id est loggé avec chaque réponse coach pour l'audit." Les 6 flows
// coach en périmètre (docs/OPEN_QUESTIONS.md, Q2 : dailyWorkoutRecommendation,
// trainingPlanGeneration, planWeekSessions, coachChat, rideAnalysis,
// recoveryInsight) appellent EXCLUSIVEMENT l'une des deux fonctions
// ci-dessous — plus jamais `generateJson`/`anthropic.messages.create`
// directement (voir le garde-fou CI n°4, evidence/ci-guardrails.test.ts,
// resserré sur ce fichier + src/ai/anthropic.ts par cette même PR).
//
// Deux fonctions plutôt qu'une, parce que 5 des 6 flows produisent une
// réponse JSON structurée (le contrat verdict/summary/recommendation/
// reasons/uncertainty s'y applique pleinement — invokeCoachJson), tandis
// que coachChat est conversationnel : texte libre OU appel d'outil
// (tool_use), jamais les deux en même temps qu'un objet JSON strict.
// Forcer le contrat de sortie sur un tour de chat entrerait en conflit
// avec le format tool_use de l'API et ne correspond pas à une réponse
// conversationnelle — invokeCoachConversational reste donc SANS le
// contrat JSON, mais avec exactement le même socle de règles versionné
// (buildSystemPrompt) et le même logging d'audit. `cyclingOutfitRecommendation`
// et `identifyPlant` restent hors périmètre (Q2) et continuent d'appeler
// `generateJson` directement — ils n'ont pas de dépendance aux règles
// coach cyclisme/entraînement.

import type { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, generateJson, type FlowResult } from '@/ai/anthropic'
import { buildSystemPrompt, type CoachFlowId } from './buildSystemPrompt'
import { describeCoachOutputContract } from './outputContract'
import { computePromptVersion } from './promptVersion'

interface InvokeCoachJsonParams {
  flowId: CoachFlowId
  /** Instructions propres à la tâche du flow (contexte, règles impératives spécifiques, forme du JSON propre au flow) — préfixées par le socle de règles + le contrat de sortie. */
  taskSystemPrompt: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
}

/**
 * Point d'entrée unique pour toute réponse coach structurée en JSON (5 des
 * 6 flows en périmètre — voir coachChat/invokeCoachConversational
 * ci-dessous pour l'exception documentée). `schema` DOIT être construit
 * via `withCoachOutputContract` (outputContract.ts) — sinon la réponse
 * n'est structurellement pas garantie de porter verdict/reasons/uncertainty,
 * ce que le garde-fou CI de contrat de sortie (evidence/ci-guardrails.test.ts)
 * vérifie sur chaque flow migré.
 */
export async function invokeCoachJson<T extends z.ZodTypeAny>(
  schema: T,
  { flowId, taskSystemPrompt, messages, maxTokens = 4096 }: InvokeCoachJsonParams
): Promise<FlowResult<z.infer<T>>> {
  const version = computePromptVersion(flowId)
  console.log(`[invokeCoach] flow=${flowId} promptVersion=${version} mode=json`)

  const system = `${buildSystemPrompt(flowId)}\n\n${describeCoachOutputContract()}\n\n${taskSystemPrompt}`
  return generateJson(schema, { system, messages, maxTokens })
}

interface InvokeCoachConversationalParams {
  flowId: CoachFlowId
  taskSystemPrompt: string
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  maxTokens?: number
}

export interface CoachConversationalResult {
  stopReason: Anthropic.Message['stop_reason']
  content: Anthropic.ContentBlock[]
}

/**
 * Point d'entrée unique pour coachChat — texte libre ou appel d'outil,
 * jamais le contrat JSON strict (voir le commentaire d'en-tête). Reste
 * pleinement adossé aux règles : même `buildSystemPrompt(flowId)` versionné
 * et loggé que invokeCoachJson, juste sans `describeCoachOutputContract()`
 * ni validation de schéma — l'appelant (coach-chat-flow.ts) interprète
 * `stopReason`/`content` lui-même (texte si 'end_turn', tool_use blocks
 * si 'tool_use').
 */
export async function invokeCoachConversational({
  flowId,
  taskSystemPrompt,
  messages,
  tools,
  maxTokens = 1024,
}: InvokeCoachConversationalParams): Promise<FlowResult<CoachConversationalResult>> {
  const version = computePromptVersion(flowId)
  console.log(`[invokeCoach] flow=${flowId} promptVersion=${version} mode=conversational`)

  const system = `${buildSystemPrompt(flowId)}\n\n${taskSystemPrompt}`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    })
    return { ok: true, data: { stopReason: response.stop_reason, content: response.content } }
  } catch (e) {
    console.error('[invokeCoachConversational] Anthropic API call failed:', e)
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue lors de l'appel à l'IA." }
  }
}
