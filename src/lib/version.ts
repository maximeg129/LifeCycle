import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Deployed-version info, injected at build time (see next.config.ts) — lets
// us tell at a glance which commit is actually live, given ABIU auto-deploys
// silently on every push to main and past bugs in this app have repeatedly
// turned out to be "the fix never actually deployed".
export const APP_VERSION = {
  gitSha: process.env.NEXT_PUBLIC_GIT_SHA || 'dev',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
}

/** Pure formatter so the display logic is testable without env/build coupling. */
export function formatVersionLabel(gitSha: string, buildTimeIso: string | null): string {
  if (!buildTimeIso) return gitSha
  const parsed = new Date(buildTimeIso)
  if (Number.isNaN(parsed.getTime())) return gitSha
  return `${gitSha} · ${format(parsed, 'dd/MM HH:mm', { locale: fr })}`
}
