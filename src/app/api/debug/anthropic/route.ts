import { NextResponse } from 'next/server'
import { anthropic, CLAUDE_MODEL } from '@/ai/anthropic'

/**
 * Temporary diagnostic route — visit directly in a browser (or curl), no
 * auth headers needed, same unauthenticated-debug-route posture as
 * /api/intervals/debug for this personal single-user app.
 *
 * Why this exists: a plain Next.js Route Handler's response is NOT subject
 * to the RSC/Server-Action production redaction that anthropic.ts's own
 * console.error logging is otherwise hidden behind (see FlowResult's doc
 * comment) — this endpoint can safely echo the *raw* error straight to the
 * browser, no Firebase/Cloud Run log access needed, to tell apart "the
 * ANTHROPIC_API_KEY secret genuinely isn't reaching this backend" from
 * "the key is there but something else about the call fails".
 *
 * Delete this route once the live app-generation flow is confirmed working
 * again — it's a debugging aid, not a feature, and every hit costs a (tiny,
 * ~10-token) real API call.
 */
export async function GET() {
  const rawKey = process.env.ANTHROPIC_API_KEY
  const hasApiKey = !!rawKey
  const apiKeyPreview = rawKey ? `${rawKey.slice(0, 7)}...${rawKey.slice(-4)} (${rawKey.length} caractères)` : null

  let apiCall:
    | { ok: true; text: string }
    | { ok: false; errorName?: string; errorMessage: string; status?: number }

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Réponds uniquement par "ok".' }],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    apiCall = { ok: true, text: textBlock && 'text' in textBlock ? textBlock.text : '(pas de bloc texte dans la réponse)' }
  } catch (e) {
    const status = typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined
    apiCall = {
      ok: false,
      errorName: e instanceof Error ? e.name : undefined,
      errorMessage: e instanceof Error ? e.message : String(e),
      status,
    }
  }

  return NextResponse.json({
    _debug: 'anthropic',
    model: CLAUDE_MODEL,
    hasApiKey,
    apiKeyPreview,
    apiCall,
  })
}
