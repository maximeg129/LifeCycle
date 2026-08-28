"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, AlertTriangle, Target, Archive } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useTrainingPlan } from './use-training-plan'
import { currentPlanWeek, type PlanPhase, type PlanWeek } from './training-plan-types'
import { upcomingGoals } from './coach-memory-types'
import { EmptyState } from '@/components/ui/empty-state'

const DEFAULT_WEEKLY_MINUTES = 360

const PHASE_LABELS: Record<PlanPhase, string> = {
  base: 'Base',
  build: 'Développement',
  peak: 'Pic',
  taper: 'Affûtage',
  recovery: 'Récupération',
}

const PHASE_BADGE_CLASS: Record<PlanPhase, string> = {
  base: 'bg-blue-500/10 text-blue-500',
  build: 'bg-orange-500/10 text-orange-500',
  peak: 'bg-red-500/10 text-red-500',
  taper: 'bg-purple-500/10 text-purple-500',
  recovery: 'bg-green-500/10 text-green-500',
}

export function TrainingPlanTab() {
  const { activePlan, isLoadingPlan, isGenerating, goals, isLoadingGoals, generate, archivePlan } = useTrainingPlan()
  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = upcomingGoals(goals, today)

  const [selectedGoalId, setSelectedGoalId] = useState<string>('')
  const [weeklyMinutes, setWeeklyMinutes] = useState(DEFAULT_WEEKLY_MINUTES)
  const [showNewPlanForm, setShowNewPlanForm] = useState(false)

  const handleGenerate = async () => {
    const goal = upcoming.find((g) => g.id === selectedGoalId)
    if (!goal) return
    const ok = await generate(goal, weeklyMinutes)
    if (ok) setShowNewPlanForm(false)
  }

  const week = activePlan ? currentPlanWeek(activePlan.weeks, today) : null

  const NewPlanForm = (
    <Card className="bg-card/40 border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> {activePlan ? 'Nouveau plan' : 'Créer un plan'}
        </CardTitle>
        <CardDescription>
          Choisissez un objectif et le temps que vous pouvez consacrer à l&apos;entraînement une semaine normale —
          l&apos;IA construit une périodisation (base → développement → pic → affûtage) jusqu&apos;à cette date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingGoals ? (
          <Skeleton className="h-10 w-full" />
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ajoutez d&apos;abord un objectif à venir dans l&apos;onglet &laquo;&nbsp;Mémoire coach&nbsp;&raquo; pour pouvoir générer un plan.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Objectif</Label>
              <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                <SelectTrigger><SelectValue placeholder="Choisir un objectif" /></SelectTrigger>
                <SelectContent>
                  {upcoming.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.eventName} — {format(new Date(`${g.eventDate}T00:00:00`), 'dd MMM yyyy', { locale: fr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-w-[200px]">
              <Label htmlFor="weekly-minutes">Volume hebdo disponible (min)</Label>
              <Input
                id="weekly-minutes"
                type="number"
                min={60}
                max={1500}
                step={15}
                value={weeklyMinutes}
                onChange={(e) => setWeeklyMinutes(Number(e.target.value))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={isGenerating || !selectedGoalId} className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Générer le plan
              </Button>
              {activePlan && (
                <Button variant="outline" onClick={() => setShowNewPlanForm(false)}>Annuler</Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )

  if (isLoadingPlan) return <Skeleton className="h-64 w-full rounded-2xl" />

  if (!activePlan || showNewPlanForm) {
    return (
      <div className="space-y-6">
        {NewPlanForm}
        {!activePlan && (
          <EmptyState
            icon={Target}
            title="Aucun plan actif"
            description="Générez un plan pour donner un cap sur plusieurs semaines à la proposition du jour."
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 border-primary/20 border-2">
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">{activePlan.name}</CardTitle>
            <CardDescription>
              {activePlan.eventName} — {format(new Date(`${activePlan.eventDate}T00:00:00`), 'dd MMMM yyyy', { locale: fr })}
              {' · '}{activePlan.weeks.length} semaines
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNewPlanForm(true)} className="gap-2">
              <Sparkles className="w-4 h-4" /> Nouveau plan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => archivePlan(activePlan.id)} className="gap-2 text-muted-foreground">
              <Archive className="w-4 h-4" /> Archiver
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePlan.warnings.length > 0 && (
            <div className="space-y-2">
              {activePlan.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {week && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Semaine actuelle</p>
                <p className="text-sm font-medium mt-1">{week.focus || PHASE_LABELS[week.phase]}</p>
              </div>
              <Badge className={cn('font-bold', PHASE_BADGE_CLASS[week.phase])}>{PHASE_LABELS[week.phase]}</Badge>
            </div>
          )}

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase border-b border-border">
                  <th className="px-2 py-2 font-medium">Semaine</th>
                  <th className="px-2 py-2 font-medium">Dates</th>
                  <th className="px-2 py-2 font-medium">Phase</th>
                  <th className="px-2 py-2 font-medium">Focus</th>
                  <th className="px-2 py-2 font-medium text-right">Volume cible</th>
                </tr>
              </thead>
              <tbody>
                {activePlan.weeks.map((w: PlanWeek) => {
                  const isCurrent = week?.weekNumber === w.weekNumber
                  return (
                    <tr key={w.weekNumber} className={cn('border-b border-border/50', isCurrent && 'bg-primary/5')}>
                      <td className="px-2 py-2 font-medium">S{w.weekNumber}</td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                        {format(new Date(`${w.startDate}T00:00:00`), 'dd MMM', { locale: fr })}
                      </td>
                      <td className="px-2 py-2"><Badge variant="outline" className={cn('text-[10px]', PHASE_BADGE_CLASS[w.phase])}>{PHASE_LABELS[w.phase]}</Badge></td>
                      <td className="px-2 py-2">{w.focus}{w.notes && <span className="block text-xs text-muted-foreground">{w.notes}</span>}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{Math.round(w.targetWeeklyMinutes / 60 * 10) / 10}h</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
