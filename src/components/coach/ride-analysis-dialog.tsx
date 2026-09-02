"use client"

// Per-ride "Analyser" trigger + result panel for the Sorties journal — see
// use-ride-analysis.ts for the data plumbing. Rendered inside a row that's
// itself an <a> (whole-row link out to Intervals.icu — see
// rides-journal-tab.tsx), so the trigger stops propagation/default exactly
// like QuickFeedbackButton's Popover trigger does for the same reason.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, TrendingUp, Zap, Target, BatteryMedium, HeartPulse } from 'lucide-react'
import { useRideAnalysis } from './use-ride-analysis'
import { summarizeDurabilityForDisplay } from './ride-analysis-types'
import { cn } from '@/lib/utils'

interface Props {
  activityId: string
  rideLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RideAnalysisDialog({ activityId, rideLabel, open, onOpenChange }: Props) {
  const { analysis, durability, decoupling, isLoadingStored, isGenerating, canAnalyze, generate } = useRideAnalysis(open ? activityId : null)
  const durabilitySummary = summarizeDurabilityForDisplay(durability)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{analysis?.headline || 'Analyse de la sortie'}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{rideLabel}</p>

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
            <p className="text-sm leading-relaxed">{analysis.summary}</p>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
              <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">{analysis.effortContext}</p>
            </div>

            {/* Retour utilisateur, audit des indicateurs Cyclisme : "mettre
                tous les indicateurs que nous avons définis" — durability.ts
                et decoupling.ts étaient déjà calculés pour le prompt IA
                ci-dessus (voir use-ride-analysis.ts) mais jamais affichés
                comme chiffre autonome. Deux encarts chiffrés, en plus du
                texte IA déjà généré — pas de remplacement, un complément. */}
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

            {analysis.strengths.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="font-bold text-xs flex items-center gap-1.5 text-green-600">
                  <TrendingUp className="w-3.5 h-3.5" /> Points forts
                </h5>
                <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                  {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {analysis.improvementAreas.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="font-bold text-xs flex items-center gap-1.5 text-orange-600">
                  <Zap className="w-3.5 h-3.5" /> À travailler
                </h5>
                <ul className="text-xs space-y-1 text-muted-foreground list-disc pl-4">
                  {analysis.improvementAreas.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-muted/40 border border-border">
              <p className="text-xs font-semibold mb-1">Pour la suite</p>
              <p className="text-sm">{analysis.recommendation}</p>
            </div>

            <Button variant="outline" size="sm" onClick={generate} disabled={isGenerating} className="rounded-full gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Régénérer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
