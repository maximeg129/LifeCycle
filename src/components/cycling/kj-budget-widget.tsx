"use client"

import Link from 'next/link'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { useKJBudget } from './use-kj-budget'
import type { GovernorStatus } from './load-types'

const trendIcon: Record<string, typeof TrendingUp> = { up: TrendingUp, down: TrendingDown, flat: Minus }

export function KJBudgetWidget({ governorStatus }: { governorStatus: GovernorStatus }) {
  const budget = useKJBudget(governorStatus)

  if (budget.isLoading) {
    return (
      <div className="bg-card/40 border border-border rounded-lg p-6">
        <Skeleton className="h-3 w-32 mb-4" />
        <Skeleton className="h-10 w-40 mb-2" />
        <Skeleton className="h-2 w-full" />
      </div>
    )
  }

  const TrendIcon = trendIcon[budget.trend.direction]
  const pct = budget.target > 0 ? Math.min(100, Math.round((budget.realized / budget.target) * 100)) : 0

  return (
    // Carte entière cliquable → /cycling/budget (méthode de calcul détaillée) — même
    // convention que MetricTile/RingItem (performance-bento.tsx).
    <Link href="/cycling/budget" className="block group relative">
      <ChevronRight className="absolute top-4 right-4 w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform z-10" />
      <MetricCard
        title="Budget de la semaine"
        description="Travail mécanique réel (puissance × durée), pas un TSS pondéré arbitrairement"
        icon={Flame}
        isAvailable={budget.isAvailable}
        requiredInputs={["Puissance (watts) enregistrée sur au moins une séance récente"]}
        className="group-hover:border-primary/40 transition-colors"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{budget.realized}</span>
          <span className="text-lg text-muted-foreground">/ {budget.target || '—'} kJ</span>
        </div>
        <Progress value={pct} className="h-1.5 mt-3" />
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Base 8 sem. : {budget.baseline || '—'} kJ</span>
          {budget.trend.direction !== 'flat' ? (
            <span className={`flex items-center gap-1 ${budget.trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              <TrendIcon className="w-3 h-3" /> {budget.trend.pctChange > 0 ? '+' : ''}{budget.trend.pctChange}% / 8 sem.
            </span>
          ) : (
            <span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Stable</span>
          )}
        </div>
      </MetricCard>
    </Link>
  )
}
