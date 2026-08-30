import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

/**
 * Shared Claude client. Reads ANTHROPIC_API_KEY from the environment — see
 * apphosting.yaml (the secret must exist in Secret Manager and be granted
 * to this backend, same setup as the former GEMINI_API_KEY).
 */
export const anthropic = new Anthropic()

/**
 * All flows in this app are short, low-volume, personal-use calls — Haiku
 * 4.5 is plenty capable for structured JSON generation and vision, at a
 * fraction of the cost of the Opus/Sonnet tiers.
 */
export const CLAUDE_MODEL = 'claude-haiku-4-5'

interface GenerateJsonParams {
  system: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
}

/**
 * Asks Claude to respond with a single JSON object (the system prompt must
 * instruct this), extracts it from the response text, and validates it
 * against `schema`. Tolerates the model wrapping the JSON in a markdown
 * fence or a short sentence — extracts the first `{...}` block rather than
 * requiring the entire response to be pure JSON.
 */
export async function generateJson<T extends z.ZodTypeAny>(
  schema: T,
  { system, messages, maxTokens = 4096 }: GenerateJsonParams
): Promise<z.infer<T>> {
  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    })
  } catch (e) {
    // Logged server-side (Firebase App Hosting / Cloud Run logs) — the
    // caller's UI only ever shows a generic "l'IA n'a pas pu générer..."
    // toast, so this is the only place the real cause (auth, rate limit,
    // invalid request, network) is visible for debugging a production report.
    console.error('[generateJson] Anthropic API call failed:', e)
    throw e
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) throw new Error('Claude did not return a text response')

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON object found in Claude response: ${textBlock.text.slice(0, 200)}`)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Claude response was not valid JSON: ${jsonMatch[0].slice(0, 200)}`)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error('[generateJson] Response failed schema validation:', result.error.message, '\nRaw response:', jsonMatch[0].slice(0, 2000))
    throw new Error(`La réponse de l'IA n'a pas le format attendu : ${result.error.issues[0]?.message ?? 'erreur de validation'}`)
  }
  return result.data
}
