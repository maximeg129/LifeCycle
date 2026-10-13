"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, Target, Archive, ChevronDown, History, RefreshCw, ShieldAlert, TrendingUp, ShieldQuestion, CalendarClock } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useTrainingPlan } from './use-training-plan'
import { useTrainingPreferences } from './use-training-preferences'
import { currentPlanWeek, computePlanProgress, PHASE_LABELS, PHASE_BADGE_CLASS } from './training-plan-types'
import { RingGauge } from './ring-gauge'
import { upcomingGoals } from './coach-memory-types'
import { EmptyState } from '@/components/ui/empty-state'
import { checkLoadProgressionWithoutDeload } from '@/domain/cycling/validation/planValidator'
import { SourceCitation } from '@/components/coach/source-citation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PlanOverviewGrid } from './plan-overview-grid'
import { PlanWeekCalendar } from './plan-week-calendar'
import { PlanAdherenceChart } from './plan-adherence-chart'
import { buildPlanAttentionItems } from './plan-attention-types'
import { PlanAttentionBadge } from './plan-attention-badge'
import { IntervalsOnboardingNotice } from './intervals-onboarding-notice'
import { PlanAvailabilityDialog, DEFAULT_WEEKLY_AVAILABILITY, formatDayMinutes } from './plan-availability-dialog'

// ── Plan — écran de gestion complet (/plan) ─────────────────────────────
//
// Refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md §3.1/3.5) : extrait du
// Sheet qui vivait jusqu'ici dans training-plan-tab.tsx (voir CLAUDE.md,
// "Refonte UX v2... Plan derrière un bouton Plan comme sur join") — la
// revue externe demande explicitement que Plan devienne sa PROPRE PAGE
// top-level plutôt qu'un modal, donc le Sheet disparaît : ce composant EST
// maintenant le contenu de /app/plan/page.tsx directement. La séance du
// jour (PendingFeedbackBanner/DailyWorkoutTab/PlanNextSessionsList) reste
// sur Aujourd'hui (voir training-plan-tab.tsx, slimmé à cette seule
// responsabilité) — jamais dupliquée ici. Appelle sa PROPRE instance de
// useTrainingPlan() (deuxième listener Firestore indépendant sur
// trainingPlans, même donnée) plutôt que de la recevoir en props depuis un
// parent commun : les deux écrans sont maintenant des ROUTES séparées,
// sans ancêtre React partagé pour threader un seul appel de hook.
export function PlanTab() {
  const {
    activePlan, isLoadingPlan, isGenerating, goals, isLoadingGoals, generate, archivePlan,
    generateWeekSessions, generatingSessionsForWeek, moveSessionDate, adjustSessionForLocation, adjustingLocationKey,
    addStrengthExercise, addStrengthExerciseSet,
    getSessionCompletion, sendSessionToIntervals, sendingSessionKey, canSendToIntervals,
    recalibrateNow, isRecalibrating, activities, athleteFtp,
  } = useTrainingPlan()
  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = upcomingGoals(goals, today)

  const trainingPrefs = useTrainingPreferences()
  const [selectedGoalId, setSelectedGoalId] = useState<string>('')
  const [weeklyAvailability, setWeeklyAvailability] = useState<number[]>(DEFAULT_WEEKLY_AVAILABILITY)
  const weeklyMinutes = weeklyAvailability.reduce((sum, m) => sum + m, 0)
  const [includeStrength, setIncludeStrength] = useState(false)
  const [strengthMinutes, setStrengthMinutes] = useState(60)
  const [showNewPlanForm, setShowNewPlanForm] = useState(false)
  const [showPlanReasoning, setShowPlanReasoning] = useState(false)
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const { toast } = useToast()
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null)

  const prefsAppliedRef = useRef(false)
  useEffect(() => {
    if (prefsAppliedRef.current || !trainingPrefs.data) return
    prefsAppliedRef.current = true
    if (trainingPrefs.data.includeStrengthTraining) setIncludeStrength(true)
    if (trainingPrefs.data.strengthWeeklyMinutes) setStrengthMinutes(trainingPrefs.data.strengthWeeklyMinutes)
    if (trainingPrefs.data.weeklyAvailabilityMinutes?.length === 7) setWeeklyAvailability(trainingPrefs.data.weeklyAvailabilityMinutes)
  }, [trainingPrefs.data])

  const handleGenerate = async () => {
    const goal = upcoming.find((g) => g.id === selectedGoalId)
    if (!goal) return
    const ok = await generate(goal, weeklyMinutes, { include: includeStrength, weeklyMinutes: strengthMinutes })
    if (ok) setShowNewPlanForm(false)
  }

  const handleToggleStrength = (checked: boolean) => {
    setIncludeStrength(checked)
    trainingPrefs.setPreferences({ includeStrengthTraining: checked })
  }
  const handleStrengthMinutesChange = (minutes: number) => {
    setStrengthMinutes(minutes)
    trainingPrefs.setPreferences({ strengthWeeklyMinutes: minutes })
  }
  const week = activePlan ? currentPlanWeek(activePlan.weeks, today) : null

  const handleValidateAvailability = async (next: number[]) => {
    setIsSavingAvailability(true)
    setWeeklyAvailability(next)
    await trainingPrefs.setPreferences({ weeklyAvailabilityMinutes: next })
    if (week) {
      const ok = await generateWeekSessions(week)
      if (ok) {
        toast({ title: 'Disponibilité mise à jour', description: 'Les séances de la semaine ont été recalculées avec cette nouvelle disponibilité.' })
      }
    } else {
      toast({ title: 'Disponibilité mise à jour' })
    }
    setIsSavingAvailability(false)
    setAvailabilityDialogOpen(false)
  }

  const currentWeekCompletions = useMemo(
    () => (week && week.sampleSessions ? week.sampleSessions.map((s, i) => getSessionCompletion(week, s, i)) : []),
    [week, getSessionCompletion]
  )
  const planProgress = activePlan ? computePlanProgress(activePlan, week, currentWeekCompletions, today) : null

  useEffect(() => {
    if (selectedWeekNumber != null || !activePlan) return
    setSelectedWeekNumber(week?.weekNumber ?? activePlan.weeks[0]?.weekNumber ?? null)
  }, [activePlan, week, selectedWeekNumber])

  const autoGeneratedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!week || week.sampleSessions || generatingSessionsForWeek != null) return
    if (autoGeneratedRef.current === week.weekNumber) return
    autoGeneratedRef.current = week.weekNumber
    generateWeekSessions(week)
  }, [week, generatingSessionsForWeek, generateWeekSessions])

  const loadProgressionCheck = useMemo(
    () => (activePlan ? checkLoadProgressionWithoutDeload(activePlan.weeks) : null),
    [activePlan]
  )

  const adjustedWeekNumbers = useMemo(() => {
    const set = new Set<number>()
    if (!activePlan?.originalWeeks) return set
    const { weeks, originalWeeks } = activePlan
    for (const w of weeks) {
      const orig = originalWeeks.find((o) => o.weekNumber === w.weekNumber)
      if (orig && (orig.phase !== w.phase || orig.focus !== w.focus || orig.targetWeeklyMinutes !== w.targetWeeklyMinutes)) {
        set.add(w.weekNumber)
      }
    }
    return set
  }, [activePlan])

  const latestRecalibration = activePlan?.recalibrations?.at(-1)
  const currentVerdict = latestRecalibration?.verdict ?? activePlan?.verdict

  const attentionItems = useMemo(
    () => buildPlanAttentionItems(
      {
        verdict: currentVerdict,
        recommendation: latestRecalibration?.recommendation ?? activePlan?.recommendation,
        warnings: latestRecalibration?.risks ?? activePlan?.warnings ?? [],
      },
      loadProgressionCheck
    ),
    [currentVerdict, latestRecalibration, activePlan, loadProgressionCheck]
  )

  const NewPlanForm = (
    <Card className="lc-card">
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
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Disponibilité hebdomadaire réglée via le bouton « Disponibilité » ci-dessus — l&apos;IA
                distribue les séances type sur les jours où vous avez le plus de temps, plutôt qu&apos;un étalement
                mécanique.
              </p>
              <span className="text-xs font-data font-semibold shrink-0">{formatDayMinutes(weeklyMinutes)}/semaine</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="include-strength" checked={includeStrength} onCheckedChange={(c) => handleToggleStrength(c === true)} />
                <Label htmlFor="include-strength" className="font-normal cursor-pointer">
                  Inclure des séances de musculation en complément
                </Label>
              </div>
              {includeStrength && (
                <div className="space-y-2 max-w-[220px] pl-6">
                  <Label htmlFor="strength-minutes">Volume musculation hebdo (min)</Label>
                  <Input
                    id="strength-minutes"
                    type="number"
                    min={15}
                    max={360}
                    step={15}
                    value={strengthMinutes}
                    onChange={(e) => handleStrengthMinutesChange(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Volume additionnel, séparé du volume vélo ci-dessus — travail de force lourd en complément, jamais à la place d&apos;une séance vélo clé.
                  </p>
                </div>
              )}
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

  const availabilityDialog = (
    <PlanAvailabilityDialog
      open={availabilityDialogOpen}
      onOpenChange={setAvailabilityDialogOpen}
      committedAvailability={weeklyAvailability}
      onValidate={handleValidateAvailability}
      isSaving={isSavingAvailability}
    />
  )

  if (!activePlan || showNewPlanForm) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setAvailabilityDialogOpen(true)} className="gap-2">
            <CalendarClock className="w-4 h-4" /> Disponibilité
          </Button>
        </div>
        {availabilityDialog}
        {!canSendToIntervals && (
          <IntervalsOnboardingNotice message="Intervals.icu non connecté — le plan peut se générer, mais les séances ne pourront pas être envoyées sur votre calendrier." />
        )}
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
      {availabilityDialog}
      <Card className="lc-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {planProgress && (
              <RingGauge percent={planProgress.weekCompletionPercent ?? 0} color="hsl(var(--primary))" trackColor="hsl(var(--border))" size={56} strokeWidth={6}>
                <span className="text-xs font-bold font-data">
                  {planProgress.weekCompletionPercent != null ? `${planProgress.weekCompletionPercent}%` : '—'}
                </span>
              </RingGauge>
            )}
            <div>
              <CardTitle className="text-lg">{activePlan.name}</CardTitle>
              <CardDescription>
                {activePlan.eventName} — {format(new Date(`${activePlan.eventDate}T00:00:00`), 'dd MMMM yyyy', { locale: fr })}
                {' · '}{activePlan.weeks.length} semaines
              </CardDescription>
              {planProgress && (
                <p className="text-xs text-muted-foreground mt-1">
                  {planProgress.daysRemaining >= 0
                    ? `${planProgress.daysRemaining} jour${planProgress.daysRemaining === 1 ? '' : 's'} avant l'objectif`
                    : `Objectif dépassé de ${Math.abs(planProgress.daysRemaining)} jour${Math.abs(planProgress.daysRemaining) === 1 ? '' : 's'}`}
                  {planProgress.weekCompletionPercent != null && ` · ${planProgress.sessionsDone}/${planProgress.sessionsTotal} séances cette semaine`}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAvailabilityDialogOpen(true)} className="gap-2">
              <CalendarClock className="w-4 h-4" /> Disponibilité
            </Button>
            <Button variant="outline" size="sm" onClick={recalibrateNow} disabled={isRecalibrating} className="gap-2">
              {isRecalibrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recalibrer
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewPlanForm(true)} className="gap-2">
              <Sparkles className="w-4 h-4" /> Nouveau plan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => archivePlan(activePlan.id)} className="gap-2 text-muted-foreground">
              <Archive className="w-4 h-4" /> Archiver
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 flex-wrap">
            {(activePlan.summary || (activePlan.reasons && activePlan.reasons.length > 0)) && (
              <Collapsible open={showPlanReasoning} onOpenChange={setShowPlanReasoning} className="flex-1 min-w-[160px]">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Pourquoi ce plan ?
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showPlanReasoning && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-3">
                  <p className="text-xs text-muted-foreground/70">
                    Plan créé la semaine du {format(new Date(`${activePlan.startDate}T00:00:00`), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  {activePlan.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{activePlan.summary}</p>
                  )}
                  {activePlan.reasons && activePlan.reasons.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        Motif de ce plan
                      </p>
                      <ul className="space-y-1.5">
                        {activePlan.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                            <span className="flex-1">{r.detail}</span>
                            <SourceCitation ruleIds={[r.rule]} label="Voir la règle citée" className="shrink-0 mt-0.5" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
            <PlanAttentionBadge items={attentionItems} />
          </div>
        </CardContent>
      </Card>

      <PlanOverviewGrid
        weeks={activePlan.weeks}
        selectedWeekNumber={selectedWeekNumber}
        onSelectWeek={setSelectedWeekNumber}
        getCompletion={(w, session, index) => getSessionCompletion(w, session, index)}
        activities={activities}
        athleteFtp={athleteFtp}
        renderExpanded={(w) => (
          <div className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium">S{w.weekNumber}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(`${w.startDate}T00:00:00`), 'dd MMM', { locale: fr })}
                  </span>
                  <Badge variant="outline" className={cn('text-[10px]', PHASE_BADGE_CLASS[w.phase])}>{PHASE_LABELS[w.phase]}</Badge>
                  {week?.weekNumber === w.weekNumber && (
                    <Badge variant="secondary" className="text-[10px]">Semaine actuelle</Badge>
                  )}
                  {adjustedWeekNumbers.has(w.weekNumber) && (
                    <Badge variant="outline" className="text-[9px] gap-0.5 text-primary border-primary/30" title="Recalibrée depuis le plan d'origine — voir le journal ci-dessous">
                      <RefreshCw className="w-2.5 h-2.5" /> ajustée
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{w.focus}</p>
                {w.notes && <p className="text-xs text-muted-foreground/80 mt-0.5">{w.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium whitespace-nowrap">{Math.round(w.targetWeeklyMinutes / 60 * 10) / 10}h</p>
                {w.targetStrengthMinutes != null && (
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">+ {Math.round(w.targetStrengthMinutes / 60 * 10) / 10}h muscu</p>
                )}
              </div>
            </div>
            <PlanWeekCalendar
              week={w}
              isGenerating={generatingSessionsForWeek === w.weekNumber}
              sendingSessionKey={sendingSessionKey}
              canSendToIntervals={canSendToIntervals}
              onRegenerate={() => generateWeekSessions(w)}
              onSend={(session, index, dateId) => sendSessionToIntervals(session, w.weekNumber, index, dateId)}
              onMoveDate={(index, newDate) => moveSessionDate(w.weekNumber, index, newDate)}
              getCompletion={(session, index) => getSessionCompletion(w, session, index)}
              activities={activities}
              athleteFtp={athleteFtp}
              adjustingLocationKey={adjustingLocationKey}
              onAdjustLocation={(index, targetLocation) => adjustSessionForLocation(w.weekNumber, index, targetLocation)}
              onAddExercise={(index, exercise) => addStrengthExercise(w.weekNumber, index, exercise)}
              onAddExerciseSet={(index, exerciseIndex) => addStrengthExerciseSet(w.weekNumber, index, exerciseIndex)}
            />
          </div>
        )}
      />

      {activePlan.weeks.some((w) => w.startDate <= today && (w.sampleSessions?.length ?? 0) > 0) && (
        <Card className="lc-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévu vs réalisé</CardTitle>
            <CardDescription>Adhérence au plan, semaine par semaine.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanAdherenceChart weeks={activePlan.weeks} getCompletion={(w, s, i) => getSessionCompletion(w, s, i)} todayIso={today} />
          </CardContent>
        </Card>
      )}

      {activePlan.recalibrations && activePlan.recalibrations.length > 0 && (
        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Journal du plan
            </CardTitle>
            <CardDescription>
              Le plan se recalibre automatiquement à la fin de chaque semaine, en comparant le volume réellement
              réalisé au volume ciblé — chaque ajustement est expliqué ci-dessous. Les semaines déjà passées ne
              sont jamais retouchées.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[...activePlan.recalibrations].reverse().map((entry, i) => (
              <div key={i} className={cn('space-y-3', i > 0 && 'pt-5 border-t border-border')}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {format(new Date(`${entry.date}T00:00:00`), 'dd MMM yyyy', { locale: fr })} — après la semaine {entry.throughWeekNumber}
                  </p>
                  {entry.verdict !== 'ok' && (
                    <Badge variant="outline" className={cn('text-[10px] gap-1', entry.verdict === 'block' ? 'text-destructive border-destructive/30' : 'text-yellow-600 border-yellow-500/30')}>
                      <ShieldAlert className="w-2.5 h-2.5" /> {entry.verdict === 'block' ? 'Bloquant' : 'Réserve'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>

                {(entry.strengths.length > 0 || entry.risks.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {entry.strengths.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-green-600 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" /> Points forts
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                          {entry.strengths.map((s, si) => <li key={si}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {entry.risks.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                          <ShieldQuestion className="w-3.5 h-3.5" /> Risques pour l&apos;objectif
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                          {entry.risks.map((r, ri) => <li key={ri}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {entry.reasons.length > 0 && (
                  <ul className="space-y-1.5">
                    {entry.reasons.map((r, ri) => (
                      <li key={ri} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                        <span className="flex-1">{r.detail}</span>
                        <SourceCitation ruleIds={[r.rule]} label="Voir la règle citée" className="shrink-0 mt-0.5" />
                      </li>
                    ))}
                  </ul>
                )}
                {entry.changes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun changement — le plan initial restait adapté.</p>
                ) : (
                  <div className="space-y-2">
                    {entry.changes.map((c) => (
                      <div key={c.weekNumber} className="flex items-center gap-2 flex-wrap text-xs p-2.5 rounded-lg bg-muted/40 border border-border">
                        <span className="font-medium shrink-0">S{c.weekNumber}</span>
                        <span className="text-muted-foreground line-through">
                          {PHASE_LABELS[c.before.phase]} · {c.before.focus} · {Math.round(c.before.targetWeeklyMinutes / 60 * 10) / 10}h
                          {c.before.targetStrengthMinutes != null && ` + ${Math.round(c.before.targetStrengthMinutes / 60 * 10) / 10}h muscu`}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-foreground font-medium">
                          {PHASE_LABELS[c.after.phase]} · {c.after.focus} · {Math.round(c.after.targetWeeklyMinutes / 60 * 10) / 10}h
                          {c.after.targetStrengthMinutes != null && ` + ${Math.round(c.after.targetStrengthMinutes / 60 * 10) / 10}h muscu`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
