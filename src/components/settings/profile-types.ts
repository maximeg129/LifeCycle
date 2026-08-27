/**
 * Avatar fallback initials: prefers the display name, falls back to the
 * email, and finally a "?" placeholder when neither is set yet.
 */
export function getProfileInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  const source = displayName || email || '?'
  return source.slice(0, 2).toUpperCase()
}
