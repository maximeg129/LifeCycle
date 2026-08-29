// The LifeCycle mark — an abstract route/pulse-profile squiggle, replacing
// a plain Lucide "Bike" icon on a primary-colored badge (see the design-
// identity work in AUDIT.md/PLAN.md — the old mark was indistinguishable
// from any other icon-on-rounded-square app icon). Matches public/icon.svg
// exactly, kept as its own dark badge regardless of the active theme so
// the mark reads consistently wherever it appears.

import { cn } from '@/lib/utils'

export function LifeCycleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#15170F" />
      <path
        d="M20 64 L36 34 L48 52 L58 28 L80 64"
        fill="none"
        stroke="#C8F65A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
