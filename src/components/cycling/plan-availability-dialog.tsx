"use client"

// ── Disponibilité hebdomadaire — dialog avec validation explicite ────────
//
// Retour utilisateur (captures Join/Frive à l'appui), après la première
// version en carte permanente (voir CLAUDE.md "Refonte UX — disponibilité
// permanente...") : "nous avons le slider avec la dispo, peut être devrons
// nous avoir un bouton modifier pour changer et ensuite rebloque l'agenda
// des 7 prochains jours, lorsque c'est validé l'IA recalibre les
// entraînements sur la base du plan de départ." Deux changements par
// rapport à la version précédente :
// 1. Les curseurs vivent maintenant derrière un bouton "Disponibilité"
//    (training-plan-tab.tsx) plutôt qu'une carte toujours visible — état
//    LOCAL (staged) le temps du dialog, jamais écrit en direct à chaque
//    glissement comme avant : seul "Valider" persiste.
// 2. "Valider" ne se contente plus d'écrire la préférence : il déclenche
//    une VRAIE régénération IA de la semaine courante (generateWeekSessions,
//    le même appel que le bouton "Régénérer" existant) — le contenu des
//    séances s'adapte réellement au nouveau volume/répartition, pas
//    seulement leurs dates (le reséquencement mécanique glissant, chantier
//    A, continue de tourner en plus, automatiquement, sans rapport avec ce
//    dialog).

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Loader2 } from 'lucide-react'

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

// Somme = 360 — un défaut UX plausible (week-end plus disponible qu'un jour
// de semaine), pas une valeur scientifique.
export const DEFAULT_WEEKLY_AVAILABILITY: number[] = [30, 60, 30, 60, 30, 90, 60]

export function formatDayMinutes(minutes: number): string {
  if (minutes === 0) return 'Repos'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dernière valeur persistée — resynchronisée dans le staging local à chaque ouverture. */
  committedAvailability: number[]
  /** Persiste + déclenche la régénération IA — voir le commentaire d'en-tête. */
  onValidate: (next: number[]) => void | Promise<void>
  isSaving: boolean
}

export function PlanAvailabilityDialog({ open, onOpenChange, committedAvailability, onValidate, isSaving }: Props) {
  const [staged, setStaged] = useState<number[]>(committedAvailability)

  // Resynchronise le staging à chaque ouverture — jamais pendant qu'il est
  // déjà ouvert (l'athlète pourrait avoir déjà bougé un curseur avant
  // qu'un changement externe, ex. Stella, n'arrive).
  useEffect(() => {
    if (open) setStaged(committedAvailability)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const stagedMinutes = staged.reduce((sum, m) => sum + m, 0)

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disponibilité hebdomadaire</DialogTitle>
          <DialogDescription>
            Combien de temps vous avez chaque jour — valider recalcule la répartition des séances de la
            semaine en cours, et l&apos;IA en régénère le contenu pour coller à ce nouveau volume.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Répartition</span>
          <span className="font-data font-semibold">{formatDayMinutes(stagedMinutes)}/semaine</span>
        </div>
        <div className="space-y-2.5">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted-foreground">{label}</span>
              <Slider
                value={[staged[i]]}
                onValueChange={([v]) => setStaged((prev) => prev.map((m, idx) => (idx === i ? v : m)))}
                min={0}
                max={240}
                step={15}
                disabled={isSaving}
                className="flex-1"
              />
              <span className="w-14 shrink-0 text-right text-xs font-data text-muted-foreground">
                {formatDayMinutes(staged[i])}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annuler</Button>
          <Button onClick={() => onValidate(staged)} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
