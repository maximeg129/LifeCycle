'use server'

// Temporary diagnostic Server Action — delete alongside the rest of the
// debug-headers/api/debug/* files. Deliberately trivial (no Anthropic call,
// no Firestore, no imports beyond what Next.js itself needs) so a failure
// here can only mean the Server Actions dispatch mechanism itself is
// broken on this deployment — not anything about the AI flows' own code.
export async function pingAction(): Promise<{ ok: true; pong: number }> {
  return { ok: true, pong: Date.now() }
}
