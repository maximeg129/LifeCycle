"use client"

// ── Canonical page header ────────────────────────────────────────────
//
// Every authenticated page used to hand-roll this same eyebrow + title
// block (`<h2 className="text-sm font-medium text-primary uppercase
// tracking-wider">…</h2>` + `<h1>…</h1>`), and it silently drifted —
// three pages were missing the eyebrow entirely, two others had a
// near-identical but not-quite-matching variant (see AUDIT.md section 3).
// This component is the single place that pattern lives now, so a future
// page can't drift from it without deliberately overriding className.

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  /** The small uppercase label above the title (e.g. "Performance", "Budget"). */
  category: string
  title: ReactNode
  /** Optional paragraph under the title. */
  description?: ReactNode
  /** Optional element between the category label and the title (e.g. a status Badge). */
  badge?: ReactNode
  /** Right-aligned content — buttons, dialogs, status badges. */
  actions?: ReactNode
  className?: string
}

export function PageHeader({ category, title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4', className)}>
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-primary uppercase tracking-wider">{category}</h2>
        {badge}
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  )
}
