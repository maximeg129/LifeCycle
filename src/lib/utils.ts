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
 * — a stale action reference from a tab/PWA session that predates the last
 * deploy, or a dropped connection. This shows up in two different raw
 * shapes depending on exactly how stale the client is:
 *   - In production the framework-level error is usually redacted to a
 *     generic "An error occurred in the Server Components render..."
 *     string regardless of cause.
 *   - Confirmed live (ride-analysis "Régénérer", hours after a fresh
 *     deploy): a second, NOT redacted shape — "Server Action
 *     '<hash>' was not found on the server. This request might be from an
 *     older or newer deployment." — the client is asking for an action id
 *     the current server build simply doesn't have.
 * Both mean the same thing (the open page predates the current deploy) and
 * both get the same actionable message rather than a cryptic hash. A
 * genuinely different message (real network error, real info) passes
 * through unchanged.
 */
export function describeActionDispatchError(e: unknown): string {
  const raw = e instanceof Error ? e.message : ''
  const isStaleDeploy = !raw
    || raw.includes('Server Components render')
    || raw.includes('Failed to find Server Action')
    || (raw.includes('Server Action') && raw.includes('was not found on the server'))
  if (isStaleDeploy) {
    return "Erreur de connexion au serveur — fermez et rouvrez complètement l'app (pas juste un rechargement) puis réessayez. Si ça persiste après ça, le souci est ailleurs."
  }
  return raw
}
