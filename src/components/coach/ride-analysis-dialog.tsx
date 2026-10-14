"use client"

// Per-ride "Analyser" trigger + result panel for the Sorties journal — see
// use-ride-analysis.ts for the data plumbing. Rendered inside a row that's
// itself an <a> (whole-row link out to Intervals.icu — see
// rides-journal-tab.tsx), so the trigger stops propagation/default exactly
// like QuickFeedbackButton's Popover trigger does for the same reason.
//
// Restructuration lifecycle-ui-reference.html, écran "Activité (detail)" —
// garde la convention déjà établie de l'app (reste un Dialog, jamais une
// route séparée, voir CLAUDE.md "Refonte UI/IA... étape 5") mais restyle
// l'en-tête (lien "‹ Activités" + eyebrow jour/date/plan + titre+badges sur
// la même ligne) et remplace la liste verticale "Respect des intervalles"
// par une vraie table "Intervalles" (colonnes #/Durée/Puissance/vs cible/FC
// max). Les encarts Durabilité/Découplage — absents de la référence mais
// une vraie fonctionnalité déjà livrée, jamais retirée sans qu'on le
// demande — restent entre le graphique et la table. Le texte IA (headline/
// summary/effortContext/strengths/improvementAreas/recommendation) est
// désormais consolidé dans UNE seule carte "Analyse du coach" (plutôt que
// 4 blocs séparés) pour matcher le format narratif de la référence —
// aucun champ de sortie IA retiré, seulement regroupé.
//
// Retour utilisateur, sur la page Activités (Journal) : "I was expecting
// this page to change, in a way where i would have the analysis of the
// last ride and a toggle to the different activities" — décision
// (AskUserQuestion, "Inline panel above the list") : un nouveau
// <RideAnalysisPanel> (ci-dessous), affiché au-dessus de la liste dans
// rides-journal-tab.tsx, montre l'analyse complète de la dernière activité
// avec des flèches précédent/suivant pour parcourir les activités récentes
// — le Dialog par ligne reste inchangé pour un coup d'œil rapide depuis la
// liste elle-même. Les deux surfaces partagent EXACTEMENT le même calcul
// (useRideAnalysisView) et le même corps (RideAnalysisBody) — jamais une
// deuxième logique qui pourrait diverger entre le panneau et le dialogue.

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KpiGrid, type KpiGridItem } from '@/components/ui/kpi-grid'
import { Sparkles, Loader2, TrendingUp, Zap, BatteryMedium, HeartPulse, ListChecks, CheckCircle2, LineChart, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { useRideAnalysis } from './use-ride-analysis'
import { summarizeDurabilityForDisplay } from './ride-analysis-types'
import { adherenceDeltaLabel } from './interval-adherence-types'
import type { IntervalAdherenceVerdict } from './interval-adherence-types'
import { buildIntervalTargetWindows } from './ride-chart-types'
import { RidePowerHrChart } from './ride-power-hr-chart'
import { formatDuration, formatDistance } from './activity-format'
import { SourceCitation } from './source-citation'
import { formatTimer } from '@/components/cycling/strength-log-types'
import { bestRpe, type IntervalsActivity } from '@/lib/intervals-api'
import { cn } from '@/lib/utils'

/** Couleur de la colonne "vs cible" — within=favorable (vert), below/above=écart à corriger (orange). Déviation consciente de la référence (qui semble utiliser une seule teinte orange sur toute la colonne) : cette convention vert/orange existe déjà dans ce fichier et reste plus informative qu'une couleur uniforme. */
const ADHERENCE_COLOR: Record<IntervalAdherenceVerdict, string> = {
  within: 'text-green-600',
  below: 'text-orange-600',
  above: 'text-orange-600',
}

const KPI_NUMBER_FORMAT = (v: number | null | undefined, digits = 0) => (v != null && !isNaN(v) ? v.toFixed(digits) : '—')

/** Même repli que la ligne du Journal (rides-journal-tab.tsx) pour le libellé d'une activité sans titre — exporté pour que RideAnalysisPanel puisse l'utiliser sans dupliquer la logique. */
export function defaultRideLabel(ride: IntervalsActivity): string {
  const dateStr = ride.start_date_local?.slice(0, 10)
  return ride.name || (dateStr ? format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }) : 'Activité')
}

/**
 * Tout le calcul partagé entre le dialogue (une activité précise, ouverte
 * depuis une ligne du Journal/du Plan) et le panneau inline "dernière
 * activité" — un seul point de calcul (header/KpiGrid/fenêtres cibles),
 * jamais une deuxième logique qui pourrait diverger entre les deux
 * surfaces. `activityId: null` tant qu'il n'y a rien à charger (dialogue
 * fermé, ou panneau sans activité) — même discipline "lazy" que
 * use-ride-analysis.ts lui-même.
 */
function useRideAnalysisView({ activityId, ride, date, rideLabel }: { activityId: string | null; ride?: IntervalsActivity; date?: string; rideLabel: string }) {
  const { analysis, durability, decoupling, plannedWorkout, intervalAdherence, chartSeries, isLoadingStored, isGenerating, canAnalyze, generate } = useRideAnalysis(activityId)
  const durabilitySummary = summarizeDurabilityForDisplay(durability)
  const targetWindows = useMemo(
    () => (intervalAdherence ? buildIntervalTargetWindows(intervalAdherence.steps) : undefined),
    [intervalAdherence]
  )
  // Cible unique affichée en légende au-dessus de la table — suppose un
  // script à intensité uniforme (le cas courant d'un bloc d'intervalles
  // répétés comme "3×4min VO2max") ; l'écart par ligne (adherenceDeltaLabel)
  // reste exact même si les étapes ont des cibles différentes.
  const targetCaption = useMemo(() => {
    const first = intervalAdherence?.steps[0]
    if (!first) return null
    return `Cible ${first.targetWattsLow}–${first.targetWattsHigh} W (${first.targetPctLow}–${first.targetPctHigh} % FTP)`
  }, [intervalAdherence])

  const activityDateIso = date ?? ride?.start_date_local?.slice(0, 10) ?? null
  const eyebrowDate = activityDateIso ? format(parseISO(activityDateIso), 'EEEE d MMMM', { locale: fr }).toUpperCase() : null
  const eyebrow = [eyebrowDate, plannedWorkout?.planWeekNumber != null ? `PLAN S${plannedWorkout.planWeekNumber}` : null].filter(Boolean).join(' · ')
  const title = plannedWorkout?.title || rideLabel
  const rpe = ride ? bestRpe(ride) : null

  const kpiItems: KpiGridItem[] | null = ride
    ? [
        { label: 'Durée', value: formatDuration(ride.moving_time) },
        { label: 'Distance', value: formatDistance(ride.distance) },
        { label: 'NP', value: KPI_NUMBER_FORMAT(ride.icu_weighted_avg_watts ?? ride.weighted_average_watts), unit: 'W' },
        { label: 'IF', value: KPI_NUMBER_FORMAT(ride.icu_intensity, 2) },
        { label: 'TSS', value: KPI_NUMBER_FORMAT(ride.icu_training_load) },
        { label: 'FC moy', value: KPI_NUMBER_FORMAT(ride.average_heartrate), unit: 'bpm' },
      ]
    : null

  return {
    analysis, durability, decoupling, plannedWorkout, intervalAdherence, chartSeries, isLoadingStored, isGenerating, canAnalyze, generate,
    durabilitySummary, targetWindows, targetCaption, eyebrow, title, rpe, kpiItems,
  }
}

type RideAnalysisView = ReturnType<typeof useRideAnalysisView>

/** Le corps partagé : KpiGrid + (générer / charger / analyse complète) — identique entre le dialogue et le panneau inline. */
function RideAnalysisBody(view: RideAnalysisView) {
  const { kpiItems, canAnalyze, isLoadingStored, analysis, isGenerating, generate, chartSeries, targetWindows, durabilitySummary, decoupling, plannedWorkout, intervalAdherence, targetCaption } = view

  return (
    <>
      {kpiItems && <KpiGrid items={kpiItems} />}

      {!canAnalyze ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Connectez Intervals.icu dans Réglages pour analyser vos sorties.
        </p>
      ) : isLoadingStored ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !analysis ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground text-center">
            Générez une analyse IA complète de cette sortie à partir de vos données Intervals.icu
            (puissance, fréquence cardiaque, zones, pacing).
          </p>
          <Button onClick={generate} disabled={isGenerating} className="rounded-full gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyser
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {chartSeries && (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
              <h5 className="font-bold text-xs flex items-center gap-1.5">
                <LineChart className="w-3.5 h-3.5 text-primary" /> Puissance & FC
              </h5>
              <RidePowerHrChart series={chartSeries} targetWindows={targetWindows} />
            </div>
          )}

          {durabilitySummary && (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
              <h5 className="font-bold text-xs flex items-center gap-1.5">
                <BatteryMedium className="w-3.5 h-3.5 text-primary" /> Durabilité (5 min)
              </h5>
              <p className="text-xs text-muted-foreground">
                Puissance max sur 5 min après avoir accumulé du travail dans la sortie, comparée au début (à froid) — jamais à un autre athlète ou à un seuil labo.
              </p>
              <div className="space-y-1">
                {durabilitySummary.map((row) => (
                  <div key={row.tierKJPerKg} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Après {row.tierKJPerKg} kJ/kg</span>
                    <span className="font-data">
                      {row.watts} W
                      <span className={cn('ml-1.5 text-xs', row.deltaPctVsFresh < 0 ? 'text-destructive' : 'text-green-600')}>
                        {row.deltaPctVsFresh > 0 ? '+' : ''}{row.deltaPctVsFresh}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {decoupling && (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1.5">
              <h5 className="font-bold text-xs flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-primary" /> Découplage cardiaque (Pw:HR)
              </h5>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">1ère moitié → 2ème moitié</span>
                <span className="font-data">
                  {decoupling.efficiencyFirstHalf.toFixed(2)} → {decoupling.efficiencySecondHalf.toFixed(2)} W/bpm
                </span>
              </div>
              <p className={cn('text-xs', decoupling.decouplingPct > 0 ? 'text-destructive' : 'text-green-600')}>
                {decoupling.decouplingPct > 0 ? '+' : ''}{decoupling.decouplingPct.toFixed(1)}%
                {decoupling.decouplingPct > 0 ? ' — dérive cardiaque (FC monte plus que la puissance)' : ' — pas de dérive notable'}
              </p>
            </div>
          )}

          {plannedWorkout && intervalAdherence && (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
              <h5 className="font-bold text-xs flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-primary" /> Intervalles
              </h5>
              <p className="text-xs text-muted-foreground">
                {targetCaption && <span className="font-medium text-foreground">{targetCaption}</span>}
                {targetCaption ? ' — ' : ''}
                {intervalAdherence.withinCount}/{intervalAdherence.steps.length} étape{intervalAdherence.steps.length > 1 ? 's' : ''} dans la cible
                (découpage approximatif du flux réel selon le script prévu, pas des tours vérifiés).
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium py-1 pr-2">#</th>
                    <th className="text-left font-medium py-1 pr-2">Durée</th>
                    <th className="text-left font-medium py-1 pr-2">Puissance</th>
                    <th className="text-left font-medium py-1 pr-2">vs cible</th>
                    <th className="text-right font-medium py-1">FC max</th>
                  </tr>
                </thead>
                <tbody>
                  {intervalAdherence.steps.map((s) => (
                    <tr key={s.index} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-2 font-data text-xs text-muted-foreground">{s.index + 1}</td>
                      <td className="py-1.5 pr-2 font-data text-xs">{formatTimer(s.targetDurationSeconds)}</td>
                      <td className="py-1.5 pr-2 font-data text-xs">{s.actualAvgWatts} W</td>
                      <td className={cn('py-1.5 pr-2 text-xs font-medium', ADHERENCE_COLOR[s.verdict])}>{adherenceDeltaLabel(s)}</td>
                      <td className="py-1.5 text-right font-data text-xs">{s.actualMaxHr ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5">
            <h5 className="font-bold text-xs flex items-center gap-1.5 text-primary">
              <Star className="w-3.5 h-3.5" /> Analyse du coach
            </h5>
            <p className="text-sm leading-relaxed">
              {analysis.headline && <span className="font-bold">{analysis.headline} </span>}
              {analysis.summary}
            </p>
            {analysis.effortContext && (
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.effortContext}</p>
            )}
            {(analysis.strengths.length > 0 || analysis.improvementAreas.length > 0) && (
              <ul className="text-sm space-y-1">
                {analysis.strengths.map((s, i) => (
                  <li key={`s-${i}`} className="flex items-start gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> {s}
                  </li>
                ))}
                {analysis.improvementAreas.map((s, i) => (
                  <li key={`i-${i}`} className="flex items-start gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" /> {s}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm leading-relaxed">
              <span className="font-bold">Prochaine fois : </span>{analysis.recommendation}
            </p>
            <div className="flex justify-end">
              <SourceCitation
                ruleIds={['ride-analysis-7-one-sentence-synthesis']}
                label="Sources"
                showLabel
                className="text-muted-foreground/70"
              />
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={generate} disabled={isGenerating} className="rounded-full gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Régénérer
          </Button>
        </div>
      )}
    </>
  )
}

/** Badges RPE/Réalisée — même vocabulaire que le badge "Réalisée" de PlanSessionDetail, jamais un vert littéral inventé pour l'occasion. */
function RideAnalysisTitleRow({ rpe }: { rpe: number | null }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {rpe != null && <Badge variant="secondary" className="text-xs">RPE {rpe}</Badge>}
      <Badge className="text-xs gap-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
        <CheckCircle2 className="w-3 h-3" /> Réalisée
      </Badge>
    </div>
  )
}

interface Props {
  activityId: string
  rideLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  ride?: IntervalsActivity
  /** Date (yyyy-MM-dd) de l'activité, pour l'eyebrow jour/date — distincte de `ride?.start_date_local` car tout appelant ne passe pas `ride` (ex. la carte "Séance réalisée" de daily-workout-tab.tsx, qui sait déjà qu'il s'agit d'aujourd'hui sans avoir chargé l'activité entière). */
  date?: string
}

export function RideAnalysisDialog({ activityId, rideLabel, open, onOpenChange, ride, date }: Props) {
  const view = useRideAnalysisView({ activityId: open ? activityId : null, ride, date, rideLabel })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl space-y-5" hideDefaultClose onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          >
            <ChevronLeft className="w-4 h-4" /> Activités
          </button>
          <div>
            {view.eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{view.eyebrow}</p>}
            <div className="flex items-start justify-between gap-2 flex-wrap mt-0.5">
              <DialogTitle asChild>
                <h2 className="text-lg font-bold leading-tight">{view.title}</h2>
              </DialogTitle>
              <RideAnalysisTitleRow rpe={view.rpe} />
            </div>
            {view.title !== rideLabel && <p className="text-xs text-muted-foreground mt-0.5">{rideLabel}</p>}
          </div>
        </div>

        <RideAnalysisBody {...view} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Panneau inline "dernière activité" — affiché en tête de la page
 * Activités (rides-journal-tab.tsx), au-dessus de la liste. Retour
 * utilisateur : "I would have the analysis of the last ride and a toggle
 * to the different activities" plutôt que de devoir ouvrir une ligne au
 * clic. `rides` est déjà trié du plus récent au plus ancien par
 * l'appelant ; l'index 0 (la dernière activité) est la sélection par
 * défaut, les flèches précédent/suivant parcourent la liste sans jamais
 * sortir de ses bornes.
 */
export function RideAnalysisPanel({ rides }: { rides: IntervalsActivity[] }) {
  const [index, setIndex] = useState(0)
  const clampedIndex = Math.min(index, Math.max(rides.length - 1, 0))
  const ride = rides[clampedIndex]
  const rideLabel = ride ? defaultRideLabel(ride) : ''
  const date = ride?.start_date_local?.slice(0, 10)
  const view = useRideAnalysisView({ activityId: ride?.id ?? null, ride, date, rideLabel })

  if (!ride) return null

  return (
    <div className="lc-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          {view.eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{view.eyebrow}</p>}
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <h2 className="text-lg font-bold leading-tight">{view.title}</h2>
            <RideAnalysisTitleRow rpe={view.rpe} />
          </div>
          {view.title !== rideLabel && <p className="text-xs text-muted-foreground mt-0.5">{rideLabel}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIndex((i) => Math.min(i + 1, rides.length - 1))}
            disabled={clampedIndex >= rides.length - 1}
            title="Activité précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-data text-muted-foreground tabular-nums">{clampedIndex + 1}/{rides.length}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={clampedIndex === 0}
            title="Activité suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <RideAnalysisBody {...view} />
    </div>
  )
}

/** The row-level trigger button — separate from RideAnalysisDialog so the dialog itself only mounts (and starts loading) once opened. */
export function RideAnalysisTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      title="Analyse IA de la sortie"
    >
      <Sparkles className="w-4 h-4" />
    </Button>
  )
}
