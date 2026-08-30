import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Every `'use server'` flow in src/ai/flows/ now returns FlowResult instead
 * of throwing (see anthropic.ts) — so if a hook calling one of them still
 * lands in its `catch`, the failure didn't come from the flow's own logic
 * at all. It happened one layer up, in Next.js's own Server Action dispatch
 * (a stale action reference from a tab/PWA session that predates the last
 * deploy — Next.js's own error is literally "Failed to find Server Action.
 * This request might be from an older or newer deployment" — or a dropped
 * connection). That framework-level error's message is always redacted to
 * a generic "An error occurred in the Server Components render..." string
 * in production regardless of cause, so showing it verbatim is useless —
 * this swaps it for an actionable one. A non-redacted message (a genuine
 * network error with real information) is passed through unchanged.
 */
export function describeActionDispatchError(e: unknown): string {
  const raw = e instanceof Error ? e.message : ''
  if (!raw || raw.includes('Server Components render')) {
    return "Erreur de connexion au serveur — fermez et rouvrez complètement l'app (pas juste un rechargement) puis réessayez. Si ça persiste après ça, le souci est ailleurs."
  }
  return raw
}
