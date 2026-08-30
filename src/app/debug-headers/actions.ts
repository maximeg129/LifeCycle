'use server'

import { anthropic, CLAUDE_MODEL } from '@/ai/anthropic'
import { dailyWorkoutRecommendation } from '@/ai/flows/daily-workout-recommendation-flow'

// Temporary diagnostic Server Action — delete alongside the rest of the
// debug-headers/api/debug/* files. Deliberately trivial (no Anthropic call,
// no Firestore, no imports beyond what Next.js itself needs) so a failure
// here can only mean the Server Actions dispatch mechanism itself is
// broken on this deployment — not anything about the AI flows' own code.
export async function pingAction(): Promise<{ ok: true; pong: number }> {
  return { ok: true, pong: Date.now() }
}

// pingAction() succeeded but the real AI flow Server Actions still fail —
// so the dispatch mechanism itself is fine. This bisects further: same
// Anthropic call /api/debug/anthropic already proved works from a plain
// Route Handler, made here instead from a genuine Server Action, to see
// whether "Server Action + Anthropic SDK" specifically is what breaks.
export async function pingAnthropicAction(): Promise<
  { ok: true; text: string } | { ok: false; errorName?: string; errorMessage: string }
> {
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Réponds uniquement par "ok".' }],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    return { ok: true, text: textBlock && 'text' in textBlock ? textBlock.text : '(pas de bloc texte)' }
  } catch (e) {
    return {
      ok: false,
      errorName: e instanceof Error ? e.name : undefined,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

// Both pingAction() and pingAnthropicAction() succeeded — so it's not the
// Server Action mechanism, nor "Server Action + Anthropic SDK" in general.
// This calls the REAL dailyWorkoutRecommendation flow (same one Proposition
// du jour uses) directly, with a minimal hardcoded input — bypassing
// useDailyWorkout/buildCoachContext/useCoachMemory/useGovernor entirely —
// to see whether the flow itself (bigger system prompt incl.
// STRUCTURED_WORKOUT_SYNTAX, higher max_tokens) breaks under real
// conditions, or whether the bug is in how the calling hook builds its
// arguments.
export async function pingDailyWorkoutAction() {
  try {
    return await dailyWorkoutRecommendation({
      date: '2026-08-30',
      availableMinutes: 60,
      recentSessions: [],
    })
  } catch (e) {
    return {
      ok: false as const,
      error: `THREW (ne devrait jamais arriver, dailyWorkoutRecommendation renvoie toujours FlowResult) : ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}
