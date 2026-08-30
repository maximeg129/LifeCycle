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
 * Every `'use server'` flow in src/ai/flows/ returns this instead of
 * throwing on failure. Next.js redacts the message of ANY error that
 * crosses the Server Action boundary in a production build — the client
 * only ever receives "An error occurred in the Server Components render...
 * The specific message is omitted in production builds" (react-server-dom's
 * resolveErrorProd()), no matter what the original Error said. A message
 * only survives the trip if it travels as ordinary *data* in a resolved
 * promise, not as a rejection — hence returning `{ ok: false, error }`
 * rather than throwing. (Confirmed against node_modules/next's
 * react-server-dom-webpack client bundle when a "L'IA n'a pas pu générer de
 * plan" toast turned out to be showing that exact generic RSC string instead
 * of the real cause, even though the calling hook forwarded `e.message`.)
 */
export type FlowResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Asks Claude to respond with a single JSON object (the system prompt must
 * instruct this), extracts it from the response text, and validates it
 * against `schema`. Tolerates the model wrapping the JSON in a markdown
 * fence or a short sentence — extracts the first `{...}` block rather than
 * requiring the entire response to be pure JSON. Never throws — every
 * failure path (API call, missing text, unparsable JSON, schema mismatch)
 * is logged server-side with console.error (visible in Firebase App
 * Hosting / Cloud Run logs) and returned as `{ ok: false, error }` — see
 * FlowResult's doc comment for why a throw here can't reach the client.
 */
export async function generateJson<T extends z.ZodTypeAny>(
  schema: T,
  { system, messages, maxTokens = 4096 }: GenerateJsonParams
): Promise<FlowResult<z.infer<T>>> {
  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    })
  } catch (e) {
    console.error('[generateJson] Anthropic API call failed:', e)
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue lors de l'appel à l'IA." }
  }

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) {
    console.error('[generateJson] No text block in Claude response:', JSON.stringify(response.content).slice(0, 500))
    return { ok: false, error: "Claude n'a renvoyé aucun texte." }
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[generateJson] No JSON object found in Claude response:', textBlock.text.slice(0, 500))
    return { ok: false, error: "La réponse de l'IA ne contenait pas de JSON exploitable." }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    console.error('[generateJson] Claude response was not valid JSON:', jsonMatch[0].slice(0, 500))
    return { ok: false, error: "La réponse de l'IA n'était pas un JSON valide." }
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    console.error('[generateJson] Response failed schema validation:', result.error.message, '\nRaw response:', jsonMatch[0].slice(0, 2000))
    return { ok: false, error: `La réponse de l'IA n'a pas le format attendu : ${result.error.issues[0]?.message ?? 'erreur de validation'}` }
  }
  return { ok: true, data: result.data }
}
