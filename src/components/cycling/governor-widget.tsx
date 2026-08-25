"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { HeartPulse, Activity, Gauge, MessageCircle, Smile } from 'lucide-react'
import { useGovernor } from './use-governor'
import type { Signal } from './governor-types'
import type { GovernorStatus } from './load-types'

const STATUS_META: Record<GovernorStatus, { emoji: string; label: string; hint: string; className: string }> = {
  vert: { emoji: '🟢', label: 'Favorable', hint: 'Le budget kJ peut augmenter', className: 'text-green-400' },
  orange: { emoji: '🟠', label: 'Stable', hint: "Ne pas augmenter la charge cette semaine", className: 'text-orange-400' },
  rouge: { emoji: '🔴', label: 'Dégradé', hint: 'Stabiliser ou réduire la charge', className: 'text-red-400' },
  insufficient_data: { emoji: '⚪', label: 'Données insuffisantes', hint: 'Ajoutez des données de récupération ou du feedback de séance', className: 'text-muted-foreground' },
}

const SIGNAL_ROWS: { key: keyof ReturnType<typeof useGovernor>['signals']; label: string; icon: typeof HeartPulse }[] = [
  { key: 'restingHR', label: 'FC repos (tendance)', icon: HeartPulse },
  { key: 'hrvTrend', label: 'HRV (tendance)', icon: Activity },
  { key: 'effortHrDrift', label: 'Dérive FC à l’effort', icon: Gauge },
  { key: 'rpe', label: 'RPE moyen (tendance)', icon: MessageCircle },
  { key: 'feelings', label: 'Sensations & motivation', icon: Smile },
]

function signalDot(signal: Signal): string {
  if (signal === 1) return 'bg-green-400'
  if (signal === -1) return 'bg-red-400'
  if (signal === 0) return 'bg-orange-400'
  return 'bg-muted-foreground/30'
}

function signalLabel(signal: Signal): string {
  if (signal === 1) return 'Favorable'
  if (signal === -1) return 'Défavorable'
  if (signal === 0) return 'Neutre'
  return 'N/D'
}

export function GovernorWidget() {
  const governor = useGovernor()
  const meta = STATUS_META[governor.status]

  if (governor.isLoading) {
    return (
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-2"><Skeleton className="h-3 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase">Gouverneur de charge interne</CardTitle>
        <CardDescription className="text-xs">FC repos, HRV, dérive à l&apos;effort, RPE, sensations — pas un plan rigide</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <div className={`font-semibold ${meta.className}`}>{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.hint}</div>
          </div>
        </div>
        <div className="space-y-2">
          {SIGNAL_ROWS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon className="w-3.5 h-3.5" /> {label}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${signalDot(governor.signals[key])}`} />
                {signalLabel(governor.signals[key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
