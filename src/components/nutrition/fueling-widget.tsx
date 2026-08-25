"use client"

import { useMemo } from 'react'
import { format } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, UtensilsCrossed, Scale, Beef } from 'lucide-react'
import { useAthlete, useActivities } from '@/hooks/use-intervals'
import { useNutritionData } from './use-nutrition-data'
import { totalEnergyBurnedKcal, recoveryGap, proteinTargetRange } from './fueling-types'

export function FuelingWidget() {
  const athlete = useAthlete()
  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const activities = useActivities(todayId, todayId)
  const nutrition = useNutritionData()

  const weightKg = athlete.data?.weight ?? null
  const isAvailable = weightKg != null && weightKg > 0
  const isLoading = athlete.isLoading || activities.isLoading || nutrition.isLoading

  const burned = useMemo(() => totalEnergyBurnedKcal(activities.data, weightKg), [activities.data, weightKg])
  const eaten = nutrition.totals.calories
  const gap = recoveryGap(eaten, burned)
  const protein = weightKg ? proteinTargetRange(weightKg) : null

  if (isLoading) {
    return (
      <div className="bg-card/40 border border-border rounded-lg p-6">
        <Skeleton className="h-3 w-40 mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <MetricCard
      title="Fueling vs Workload"
      description="Équilibre énergie brûlée / mangée, sur la base de votre poids Intervals.icu"
      icon={Flame}
      isAvailable={isAvailable}
      requiredInputs={["Poids corporel renseigné sur votre profil Intervals.icu"]}
      ctaLabel="Configurer Intervals.icu"
      ctaHref="/settings"
    >
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" /> Brûlé
          </div>
          <div className="text-2xl font-bold">{burned}</div>
          <div className="text-[10px] text-muted-foreground">kcal</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <UtensilsCrossed className="w-3.5 h-3.5 text-green-400" /> Mangé
          </div>
          <div className="text-2xl font-bold">{eaten}</div>
          <div className="text-[10px] text-muted-foreground">kcal</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Scale className="w-3.5 h-3.5 text-primary" /> Écart
          </div>
          <div className={`text-2xl font-bold ${gap < 0 ? 'text-red-400' : 'text-green-400'}`}>{gap > 0 ? '+' : ''}{gap}</div>
          <div className="text-[10px] text-muted-foreground">kcal récup.</div>
        </div>
      </div>

      {protein && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5"><Beef className="w-3.5 h-3.5" /> Cible protéines du jour</span>
            <span>{nutrition.totals.protein}g / {protein.min}-{protein.max}g</span>
          </div>
          <Progress value={Math.min(100, Math.round((nutrition.totals.protein / protein.max) * 100))} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1">1.6-2.0 g/kg, basé sur {weightKg} kg (Intervals.icu)</p>
        </div>
      )}
    </MetricCard>
  )
}
