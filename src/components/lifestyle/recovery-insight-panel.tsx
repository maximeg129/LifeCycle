"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, TrendingUp, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAthlete } from '@/hooks/use-intervals'
import { recoveryInsight, type RecoveryInsightOutput } from '@/ai/flows/recovery-insight-flow'
import { type HealthGoal, type HealthMetricLike } from './lifestyle-types'
import { useCoachMemory } from '@/components/cycling/use-coach-memory'
import { useKJBudget } from '@/components/cycling/use-kj-budget'
import { useGovernor } from '@/components/cycling/use-governor'
import { usePowerCurve } from '@/components/cycling/use-power-curve'
import { fitPowerDurationCurve, type PowerRecord } from '@/components/cycling/riegel-types'
import { buildCoachContext } from '@/components/cycling/coach-context'

type DailyMetric = HealthMetricLike & { dayId: string }
type WithIdGoal = HealthGoal & { id: string }

interface Props {
  dailySeries: DailyMetric[]
  goals: WithIdGoal[]
}

export function RecoveryInsightPanel({ dailySeries, goals }: Props) {
  const { toast } = useToast()
  const athlete = useAthlete()
  const memory = useCoachMemory()
  const governor = useGovernor()
  const budget = useKJBudget(governor.status)
  const powerCurve = usePowerCurve()
  const enduranceIndex = fitPowerDurationCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null
  const [result, setResult] = useState<RecoveryInsightOutput | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const coachContext = buildCoachContext({
        injuries: memory.injuries,
        lifestyle: memory.lifestyle,
        goals: memory.goals,
        rememberedFacts: memory.rememberedFacts,
        kjBudget: { realized: budget.realized, target: budget.target, baseline: budget.baseline },
        governorStatus: governor.status,
        enduranceIndex,
      })
      const flowResult = await recoveryInsight({
        dailyMetrics: dailySeries.map((d) => ({
          date: d.dayId,
          sleepHours: d.sleepHours,
          sleepQuality: d.sleepQuality,
          hrv: d.hrv,
          stressScore: d.stressScore,
          mood: d.mood,
        })),
        goals: goals.map((g) => ({ label: g.label, metric: g.metric, target: g.target, direction: g.direction })),
        training: athlete.isConfigured && athlete.data ? {
          ctl: athlete.data.ctl,
          atl: athlete.data.atl,
          tsb: athlete.data.tsb,
          rampRate: athlete.data.rampRate,
        } : undefined,
        coachContext,
      })
      if (!flowResult.ok) {
        toast({ variant: 'destructive', title: "L'IA n'a pas pu générer d'analyse", description: flowResult.error })
        return
      }
      setResult(flowResult.data)
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "L'IA n'a pas pu générer d'analyse." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {!result && (
        <div className="flex items-center justify-between p-6 rounded-2xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              Générez une analyse IA de votre récupération{athlete.isConfigured ? ' (incluant votre charge d’entraînement Intervals.icu)' : ''}.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="rounded-full shrink-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyser
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed">{result.summary}</p>

          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{result.recommendation}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.highlights.length > 0 && (
              <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-2">
                <h5 className="font-bold text-sm flex items-center gap-2 text-green-600">
                  <TrendingUp className="w-4 h-4" /> Points forts
                </h5>
                <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                  {result.highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}
            {result.watchouts.length > 0 && (
              <div className="p-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-2">
                <h5 className="font-bold text-sm flex items-center gap-2 text-orange-600">
                  <Zap className="w-4 h-4" /> À surveiller
                </h5>
                <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                  {result.watchouts.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading} className="rounded-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Régénérer
          </Button>
        </div>
      )}
    </div>
  )
}
