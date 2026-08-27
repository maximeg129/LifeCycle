"use client"

// ── Shared "no data yet" pattern ─────────────────────────────────────
//
// 12+ places across the app each rolled their own version of this (see
// AUDIT.md section 3) — different icon treatment, different text case,
// different spacing. Two sizes cover what was actually out there:
//   - "default": a full tab/section is empty (icon + bold uppercase
//     title + optional description + optional CTA)
//   - "compact": a smaller block within an already-populated page is
//     empty (a single muted line, optionally with a small icon)

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  cta?: ReactNode
  size?: 'default' | 'compact'
  className?: string
}

export function EmptyState({ icon: Icon, title, description, cta, size = 'default', className }: EmptyStateProps) {
  if (size === 'compact') {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        {Icon && <Icon className="w-5 h-5 mx-auto mb-2 opacity-40" />}
        <p>{title}</p>
        {description && <p className="text-xs mt-1 opacity-80">{description}</p>}
        {cta && <div className="mt-3">{cta}</div>}
      </div>
    )
  }

  return (
    <div className={cn('py-24 text-center flex flex-col items-center gap-3 opacity-60', className)}>
      {Icon && <Icon className="w-12 h-12 text-muted-foreground/50" />}
      <p className="font-bold uppercase tracking-widest text-xs">{title}</p>
      {description && <p className="text-sm text-muted-foreground font-normal normal-case tracking-normal">{description}</p>}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  )
}
