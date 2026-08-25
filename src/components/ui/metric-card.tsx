"use client"

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  /** True once the underlying data needed to render `children` is present. */
  isAvailable: boolean
  /** What's missing, spelled out — never leave the user guessing why the card is empty. */
  requiredInputs: string[]
  ctaLabel?: string
  /** Either a route to send the user to, or a click handler (e.g. open a dialog). */
  ctaHref?: string
  ctaAction?: () => void
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

/**
 * Wraps a dashboard metric so that missing optional data (power, HRV, poids…)
 * never renders as an empty chart or a silently-defaulted value. When
 * `isAvailable` is false, shows exactly what's missing and how to provide it.
 */
export function MetricCard({
  title,
  description,
  icon: Icon,
  isAvailable,
  requiredInputs,
  ctaLabel,
  ctaHref,
  ctaAction,
  className,
  contentClassName,
  children,
}: MetricCardProps) {
  return (
    <Card className={`bg-card/40 border-border ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>
        {isAvailable ? (
          children
        ) : (
          <div className="flex flex-col items-start gap-3 py-2">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold tracking-wide uppercase">Métrique indisponible</span>
            </div>
            {requiredInputs.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                {requiredInputs.map((input, i) => (
                  <li key={i}>{input}</li>
                ))}
              </ul>
            )}
            {ctaLabel && (ctaHref || ctaAction) && (
              ctaHref ? (
                <Link href={ctaHref}>
                  <Button variant="outline" size="sm">{ctaLabel}</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" onClick={ctaAction}>{ctaLabel}</Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
