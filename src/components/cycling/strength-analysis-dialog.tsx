"use client"

// Per-log "Analyse IA" trigger + result panel, pour le Journal (Coach) —
// pendant musculation de RideAnalysisDialog/RideAnalysisTrigger
// (src/components/coach/ride-analysis-dialog.tsx). Contrairement au vélo,
// l'analyse est déjà générée AUTOMATIQUEMENT à la fin de la séance (voir
// use-strength-session-analysis.ts, chantier "repenser planification/
// séances/feedback" pièce B3) — ce dialogue sert donc surtout à la
// CONSULTER (isLoadingStored gère l'attente pendant que la génération
// automatique tourne en tâche de fond) ; le bouton "Régénérer" reste
// disponible en secours (une séance loguée avant ce chantier n'a jamais eu
// de déclenchement automatique).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, TrendingUp, Zap, HeartPulse } from 'lucide-react'
import { useStrengthSessionAnalysis } from './use-strength-session-analysis'
import type { StrengthSessionLogWithId } from './strength-log-types'

interface Props {
  log: StrengthSessionLogWithId
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StrengthAnalysisDialog({ log, open, onOpenChange }: Props) {
  const { analysis, isLoadingStored, isGenerating, regenerate } = useStrengthSessionAnalysis(open ? log.id : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{analysis?.headline || 'Analyse de la séance'}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{log.title}</p>

        {isLoadingStored ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !analysis ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">
              {isGenerating
                ? "Génération de l'analyse en cours..."
                : "Pas encore d'analyse pour cette séance — les séances loguées après ce chantier en reçoivent une automatiquement."}
            </p>
            <Button onClick={() => regenerate(log.id, log)} disabled={isGenerating} className="rounded-full gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyser
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed">{analysis.summary}</p>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
              <HeartPulse className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">{analysis.recoveryContext}</p>
            </div>

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

            <Button variant="outline" size="sm" onClick={() => regenerate(log.id, log)} disabled={isGenerating} className="rounded-full gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Régénérer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Le déclencheur au niveau de la ligne — séparé du dialogue lui-même pour que le dialogue ne monte (et ne commence à charger) qu'une fois ouvert. */
export function StrengthAnalysisTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      title="Analyse IA de la séance"
    >
      <Sparkles className="w-4 h-4" />
    </Button>
  )
}
