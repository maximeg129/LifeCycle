"use client"

import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
    <MetricCard
      title="Budget de la semaine"
      description="Travail mécanique réel (puissance × durée), pas un TSS pondéré arbitrairement"
      icon={Flame}
      isAvailable={budget.isAvailable}
      requiredInputs={["Puissance (watts) enregistrée sur au moins une séance récente"]}
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
  )
}
