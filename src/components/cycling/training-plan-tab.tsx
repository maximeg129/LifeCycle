"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, AlertTriangle, Target, Archive, ChevronDown, Send, Wand2, History, RefreshCw, ShieldAlert, TrendingUp, ShieldQuestion, Apple } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useTrainingPlan } from './use-training-plan'
import { useTrainingPreferences } from './use-training-preferences'
import { currentPlanWeek, type PlanPhase, type PlanWeek } from './training-plan-types'
import { upcomingGoals } from './coach-memory-types'
import { EmptyState } from '@/components/ui/empty-state'
import type { PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'
import { checkLoadProgressionWithoutDeload } from '@/domain/cycling/validation/planValidator'
import { SourceCitation } from '@/components/coach/source-citation'

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
  const {
    activePlan, isLoadingPlan, isGenerating, goals, isLoadingGoals, generate, archivePlan,
    generateWeekSessions, generatingSessionsForWeek, sendSessionToIntervals, sendingSessionKey, canSendToIntervals,
  } = useTrainingPlan()
  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = upcomingGoals(goals, today)

  // Retour utilisateur : "si l'athlete le demande inclus des seance de
  // musculation dans le plan" — préférence partagée (settings/
  // trainingPreferences) entre CE toggle et le futur outil Stella, "les
  // deux" déclencheurs répondant à la même question de clarification.
  const trainingPrefs = useTrainingPreferences()
  const [selectedGoalId, setSelectedGoalId] = useState<string>('')
  const [weeklyMinutes, setWeeklyMinutes] = useState(DEFAULT_WEEKLY_MINUTES)
  const [includeStrength, setIncludeStrength] = useState(false)
  const [strengthMinutes, setStrengthMinutes] = useState(60)
  const [showNewPlanForm, setShowNewPlanForm] = useState(false)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  // Préremplit le formulaire depuis la préférence Firestore une fois
  // chargée (jamais si l'athlète a déjà touché le toggle cette session —
  // sinon rouvrir le formulaire écraserait un choix qu'il vient de faire).
  const prefsAppliedRef = useRef(false)
  useEffect(() => {
    if (prefsAppliedRef.current || !trainingPrefs.data) return
    prefsAppliedRef.current = true
    if (trainingPrefs.data.includeStrengthTraining) setIncludeStrength(true)
    if (trainingPrefs.data.strengthWeeklyMinutes) setStrengthMinutes(trainingPrefs.data.strengthWeeklyMinutes)
  }, [trainingPrefs.data])

  const toggleWeek = (w: PlanWeek) => {
    const opening = expandedWeek !== w.weekNumber
    setExpandedWeek(opening ? w.weekNumber : null)
    if (opening && !w.sampleSessions) generateWeekSessions(w)
  }

  const handleGenerate = async () => {
    const goal = upcoming.find((g) => g.id === selectedGoalId)
    if (!goal) return
    const ok = await generate(goal, weeklyMinutes, { include: includeStrength, weeklyMinutes: strengthMinutes })
    if (ok) setShowNewPlanForm(false)
  }

  // Écrit immédiatement dans settings/trainingPreferences — même source de
  // vérité que le futur outil Stella, effet immédiat sans attendre un
  // round-trip (même patron que LanguageCard, voir CLAUDE.md i18n).
  const handleToggleStrength = (checked: boolean) => {
    setIncludeStrength(checked)
    trainingPrefs.setPreferences({ includeStrengthTraining: checked })
  }
  const handleStrengthMinutesChange = (minutes: number) => {
    setStrengthMinutes(minutes)
    trainingPrefs.setPreferences({ strengthWeeklyMinutes: minutes })
  }

  const week = activePlan ? currentPlanWeek(activePlan.weeks, today) : null

  // plan-check-8 (R23, planValidator.ts) — le seul des 9 contrôles de plan
  // directement calculable ici sans donnée qui n'existe pas encore dans
  // l'app (les 7 autres ont chacun besoin d'une donnée absente à ce stade —
  // distribution de zones planifiée, sommeil perçu individualisé, bilan
  // énergétique jour par jour... — voir docs/OPEN_QUESTIONS.md Q7). Aucun
  // seuil inventé : une hausse de volume sur 4 semaines glissantes sans
  // aucune semaine "recovery" dans la fenêtre → WARN, directement depuis
  // `weeks` tel que trainingPlanGeneration le produit déjà.
  const loadProgressionCheck = useMemo(
    () => (activePlan ? checkLoadProgressionWithoutDeload(activePlan.weeks) : null),
    [activePlan]
  )

  // Retour utilisateur : "on garderais un trace du plan d'origine pour
  // pouvoir comprendre les impacts des changement" — comparaison directe
  // semaine par semaine avec originalWeeks (jamais retouché, voir
  // use-training-plan.ts), pour un badge "ajusté" visible sans avoir à
  // ouvrir le journal. Absent (Map vide) sur un plan créé avant cet ajout.
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

  // Verdict affiché = le plus à jour : la dernière recalibration si le plan
  // en a déjà une, sinon le verdict de la génération initiale. "verdict"
  // est calculé par l'IA depuis la toute première PR du contrat de sortie
  // coach mais n'était jusqu'ici jamais affiché dans cet onglet (vrai
  // oubli, corrigé ici) — contrairement à la Proposition du jour.
  const currentVerdict = activePlan?.recalibrations?.at(-1)?.verdict ?? activePlan?.verdict

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
          {/* verdict — calculé par le contrat de sortie coach depuis la
              génération, jamais affiché jusqu'ici dans cet onglet. Reflète
              la dernière recalibration si elle existe (currentVerdict),
              sinon celui de la génération initiale. Rien n'est affiché
              quand tout va bien (ok) — même langage visuel que la
              Proposition du jour. */}
          {currentVerdict && currentVerdict !== 'ok' && (
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-xl border text-sm',
                currentVerdict === 'block' ? 'bg-destructive/5 border-destructive/20' : 'bg-yellow-500/5 border-yellow-500/20'
              )}
            >
              <ShieldAlert className={cn('w-4 h-4 shrink-0 mt-0.5', currentVerdict === 'block' ? 'text-destructive' : 'text-yellow-500')} />
              <span>{activePlan.recalibrations?.at(-1)?.recommendation ?? activePlan.recommendation}</span>
            </div>
          )}

          {/* Retour utilisateur : "un paragraphe qui explique les raisons...
              quelle base il prend pour proposer ce plan... et quelles sont les
              attentes physiologiques". "summary" est redéfini pour ce flow
              (training-plan-generation-flow.ts) pour être ce paragraphe plutôt
              que l'aperçu générique en une phrase du socle. "reasons" cite les
              règles evidence/rules.ts effectivement appliquées, chacune avec
              son SourceCitation — absent sur un plan généré avant cet ajout. */}
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

          {loadProgressionCheck && loadProgressionCheck.verdict === 'warn' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <span className="flex-1">{loadProgressionCheck.detail}</span>
              <SourceCitation ruleIds={['plan-check-8-load-progression']} label="Source du contrôle de charge" className="shrink-0" />
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
                  const isExpanded = expandedWeek === w.weekNumber
                  return (
                    <React.Fragment key={w.weekNumber}>
                      <tr
                        className={cn('border-b border-border/50 cursor-pointer hover:bg-muted/40', isCurrent && 'bg-primary/5', isExpanded && 'bg-muted/40')}
                        onClick={() => toggleWeek(w)}
                      >
                        <td className="px-2 py-2 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                            S{w.weekNumber}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                          {format(new Date(`${w.startDate}T00:00:00`), 'dd MMM', { locale: fr })}
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1">
                            <Badge variant="outline" className={cn('text-[10px]', PHASE_BADGE_CLASS[w.phase])}>{PHASE_LABELS[w.phase]}</Badge>
                            {adjustedWeekNumbers.has(w.weekNumber) && (
                              <Badge variant="outline" className="text-[9px] gap-0.5 text-primary border-primary/30" title="Recalibrée depuis le plan d'origine — voir le journal ci-dessous">
                                <RefreshCw className="w-2.5 h-2.5" /> ajustée
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2">{w.focus}{w.notes && <span className="block text-xs text-muted-foreground">{w.notes}</span>}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          {Math.round(w.targetWeeklyMinutes / 60 * 10) / 10}h
                          {w.targetStrengthMinutes != null && (
                            <span className="block text-[10px] text-muted-foreground font-normal">+ {Math.round(w.targetStrengthMinutes / 60 * 10) / 10}h muscu</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/50 bg-muted/20">
                          <td colSpan={5} className="px-2 py-3">
                            <WeekSessionsPanel
                              week={w}
                              isGenerating={generatingSessionsForWeek === w.weekNumber}
                              sendingSessionKey={sendingSessionKey}
                              canSendToIntervals={canSendToIntervals}
                              onRegenerate={() => generateWeekSessions(w)}
                              onSend={(session, index, dateId) => sendSessionToIntervals(session, w.weekNumber, index, dateId)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Retour utilisateur : "penser à automatique mais documentée on
          pourrait expliquer à l'athlète pourquoi le plan a changé". Chaque
          fois qu'une semaine se termine, use-training-plan.ts recalibre
          silencieusement les semaines restantes (pas de bouton, pas de
          confirmation) mais journalise systématiquement le pourquoi —
          cette carte EST la documentation demandée, pas une option cachée. */}
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

                {/* Bilan critique — retour utilisateur : "le coach peut il
                    émettre une critique sur le plan ou des recommendations
                    scientifiquement détaillée qui permettraient à
                    l'athlete d'atteindre ses objectif". strengths/risks
                    (même idiome que rideAnalysis) jugent la TRAJECTOIRE
                    ACTUELLE vers l'objectif, pas seulement l'ajustement de
                    cette semaine — reasons ci-dessous cite les règles qui
                    motivent chaque risque quand applicable. */}
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

interface WeekSessionsPanelProps {
  week: PlanWeek
  isGenerating: boolean
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onRegenerate: () => void
  onSend: (session: PlanWeekSession, index: number, dateId: string) => void
}

/**
 * The coach's example sessions for one plan week — lazily generated on
 * first expand (see toggleWeek in TrainingPlanTab), cached in
 * week.sampleSessions once generated. Each session can be pushed to
 * Intervals.icu for any date within the week's own range, independently
 * from "Proposition du jour" (which adapts to a specific day's real
 * conditions) — these are the phase-appropriate ideal sessions instead.
 */
function WeekSessionsPanel({ week, isGenerating, sendingSessionKey, canSendToIntervals, onRegenerate, onSend }: WeekSessionsPanelProps) {
  const [dates, setDates] = useState<Record<number, string>>({})
  const getDate = (index: number) => dates[index] ?? week.startDate

  if (isGenerating) {
    return (
      <div className="space-y-2 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Le coach compose les séances type de la semaine...
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  if (!week.sampleSessions || week.sampleSessions.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 py-2">
        <p className="text-sm text-muted-foreground">Aucune séance type pour cette semaine pour le moment.</p>
        <Button size="sm" variant="outline" onClick={onRegenerate} className="gap-2 shrink-0">
          <Wand2 className="w-3.5 h-3.5" /> Proposer les séances
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
          Séances type recommandées — S{week.weekNumber}
        </p>
        <Button size="sm" variant="ghost" onClick={onRegenerate} className="gap-1.5 text-xs text-muted-foreground h-7">
          <Wand2 className="w-3 h-3" /> Régénérer
        </Button>
      </div>
      <div className="grid gap-2">
        {week.sampleSessions.map((session, index) => {
          const key = `${week.weekNumber}-${index}`
          const isSending = sendingSessionKey === key
          return (
            <div key={index} className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{session.rationale}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{session.intensityLabel}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{session.durationMinutes} min</span>
                </div>
              </div>
              {/* Alimentation sur le vélo — même traitement que la
                  Proposition du jour (daily-workout-tab.tsx) : fourchette
                  sourcée (S03/S04), jamais un chiffre unique. session.fueling
                  gardé optionnel : une semaine générée avant l'introduction
                  de ce champ (week.sampleSessions déjà en cache Firestore)
                  n'en a pas. */}
              {session.fueling && session.fueling.neededOnBike && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                  <Apple className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {session.fueling.carbGramsPerHourMin}
                      {session.fueling.carbGramsPerHourMax != null && session.fueling.carbGramsPerHourMax !== session.fueling.carbGramsPerHourMin ? `–${session.fueling.carbGramsPerHourMax}` : ''}
                      {' '}g de glucides/h
                    </p>
                    {session.fueling.hydrationNote && <p className="text-muted-foreground">{session.fueling.hydrationNote}</p>}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  value={getDate(index)}
                  min={week.startDate}
                  max={week.endDate}
                  onChange={(e) => setDates((d) => ({ ...d, [index]: e.target.value }))}
                  className="h-8 w-auto text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => onSend(session, index, getDate(index))}
                  disabled={isSending || !canSendToIntervals}
                  className="gap-1.5 h-8"
                  title={canSendToIntervals ? undefined : 'Renseignez vos identifiants Intervals.icu dans Réglages'}
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Envoyer sur Intervals.icu
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
