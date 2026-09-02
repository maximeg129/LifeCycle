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
import { Sparkles, Loader2, Target, Archive, ChevronDown, History, RefreshCw, ShieldAlert, TrendingUp, ShieldQuestion } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useTrainingPlan } from './use-training-plan'
import { useTrainingPreferences } from './use-training-preferences'
import { currentPlanWeek, PHASE_LABELS, PHASE_BADGE_CLASS } from './training-plan-types'
import { upcomingGoals } from './coach-memory-types'
import { EmptyState } from '@/components/ui/empty-state'
import { checkLoadProgressionWithoutDeload } from '@/domain/cycling/validation/planValidator'
import { SourceCitation } from '@/components/coach/source-citation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PlanOverviewGrid } from './plan-overview-grid'
import { PlanWeekCalendar } from './plan-week-calendar'
import { buildPlanAttentionItems } from './plan-attention-types'
import { PlanAttentionBadge } from './plan-attention-badge'

const DEFAULT_WEEKLY_MINUTES = 360

export function TrainingPlanTab() {
  const {
    activePlan, isLoadingPlan, isGenerating, goals, isLoadingGoals, generate, archivePlan,
    generateWeekSessions, generatingSessionsForWeek, moveSessionDate, getSessionCompletion, sendSessionToIntervals, sendingSessionKey, canSendToIntervals,
    recalibrateNow, isRecalibrating, activities, athleteFtp,
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
  const [showPlanReasoning, setShowPlanReasoning] = useState(false)
  // Retour utilisateur : "et si on faisait une calendar view?" — la semaine
  // sélectionnée dans la grille du plan entier (PlanOverviewGrid) pilote la
  // vue détaillée (PlanWeekCalendar) juste en dessous. Initialisée à la
  // semaine courante une fois le plan chargé (voir l'effect plus bas), pas
  // au rendu initial — activePlan n'existe pas encore à ce moment.
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null)

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

  // Retour utilisateur : "pour que l'athlète sache ce qu'il a à faire" —
  // sélectionne la semaine courante dès qu'elle est connue, sans geste
  // manuel. Bascule sur la première semaine du plan si aujourd'hui tombe
  // hors de sa plage (plan pas encore démarré ou déjà terminé) plutôt que
  // de ne rien sélectionner.
  useEffect(() => {
    if (selectedWeekNumber != null || !activePlan) return
    setSelectedWeekNumber(week?.weekNumber ?? activePlan.weeks[0]?.weekNumber ?? null)
  }, [activePlan, week, selectedWeekNumber])

  // Génère automatiquement les séances de la semaine COURANTE dès l'arrivée
  // sur l'onglet — avant ce chantier, la première génération demandait un
  // clic explicite (déplier la semaine dans l'ancien accordéon) ; la vue
  // calendrier n'a plus ce geste d'expansion, l'athlète doit voir sa
  // semaine déjà composée sans action. Les autres semaines restent lazy
  // (bouton "Proposer les séances" dans PlanWeekCalendar/PlanOverviewGrid),
  // pour ne jamais déclencher tous les appels IA du plan d'un coup.
  const autoGeneratedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!week || week.sampleSessions || generatingSessionsForWeek != null) return
    if (autoGeneratedRef.current === week.weekNumber) return
    autoGeneratedRef.current = week.weekNumber
    generateWeekSessions(week)
  }, [week, generatingSessionsForWeek, generateWeekSessions])

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

  // Retour utilisateur : "ça prend quand même pas mal de place sur la page
  // et ça rallonge... plus user friendly [d']avoir des pastilles... et
  // qu'après l'utilisateur clique sur ce warning pour le voir." Consolide
  // les trois sources de vigilance (verdict, warnings de génération,
  // contrôle de progression de charge) en une seule liste — voir
  // plan-attention-types.ts — affichée par un unique badge compact
  // (PlanAttentionBadge) plutôt que trois blocs toujours dépliés.
  const attentionItems = useMemo(
    () => buildPlanAttentionItems(
      {
        verdict: currentVerdict,
        recommendation: activePlan?.recalibrations?.at(-1)?.recommendation ?? activePlan?.recommendation,
        warnings: activePlan?.warnings ?? [],
      },
      loadProgressionCheck
    ),
    [currentVerdict, activePlan, loadProgressionCheck]
  )

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
            {/* Retour utilisateur : "en gardant l'option peut-être via un
                bouton, de réajuster le plan basé sur ce qui a été
                réalistiquement fait" — la recalibration tourne déjà
                automatiquement à l'ouverture de l'onglet quand une semaine
                vient de se terminer (voir le Journal du plan plus bas) ;
                ce bouton la déclenche sur demande plutôt que d'attendre.
                Ne force rien si rien n'est dû (recalibrateNow le dit via
                toast) — jamais une deuxième recalibration de la même
                semaine déjà traitée. */}
            <Button variant="outline" size="sm" onClick={recalibrateNow} disabled={isRecalibrating} className="gap-2">
              {isRecalibrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recalibrer maintenant
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNewPlanForm(true)} className="gap-2">
              <Sparkles className="w-4 h-4" /> Nouveau plan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => archivePlan(activePlan.id)} className="gap-2 text-muted-foreground">
              <Archive className="w-4 h-4" /> Archiver
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Retour utilisateur : "un paragraphe qui explique les raisons...
              quelle base il prend pour proposer ce plan... et quelles sont les
              attentes physiologiques". "summary" est redéfini pour ce flow
              (training-plan-generation-flow.ts) pour être ce paragraphe plutôt
              que l'aperçu générique en une phrase du socle. "reasons" cite les
              règles evidence/rules.ts effectivement appliquées, chacune avec
              son SourceCitation — absent sur un plan généré avant cet ajout.
              Replié par défaut (retour utilisateur, capture d'écran à
              l'appui : "c'est pas très user friendly") — cette carte
              n'a besoin de s'ouvrir sur le paragraphe complet qu'une fois,
              pas à chaque visite de l'onglet ; le nom du plan/objectif/
              tableau des semaines juste en dessous suffit au quotidien. */}
          {/* "Pourquoi ce plan ?" et le badge de vigilance sont regroupés sur
              une même ligne — les deux sont le même geste "taper pour en
              savoir plus", voir PlanAttentionBadge pour le détail du retour
              utilisateur qui a motivé sa consolidation. */}
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

          {/* Retour utilisateur, capture d'écran (export PDF de l'app) à
              l'appui : "c'est pas idéal encore des long scroll beaucoup
              d'info et on peut se perdre, et si on faisait une calendar
              view? un peu à l'exemple de intervals". Remplace la liste de
              12 cartes-semaine empilées (chacune développable) par une
              grille compacte du plan entier — pour l'orientation, taper
              une semaine la sélectionne, qui déplie sa vue détaillée
              directement sous sa propre ligne (renderExpanded) — retour
              utilisateur après premier usage réel : "j'irai mettre chaque
              séance d'entraînement de la semaine en cours directement sous
              la semaine en cours" plutôt que dans un bloc séparé sous
              toute la grille. Chaque jour de la vue détaillée est coloré
              selon l'intensité de sa séance (réelle une fois faite, cible
              sinon — voir plan-calendar-types.ts). */}
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
                />
              </div>
            )}
          />
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
