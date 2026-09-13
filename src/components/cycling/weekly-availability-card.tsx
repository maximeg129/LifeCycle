"use client"

// ── Disponibilité hebdomadaire — carte permanente ────────────────────────
//
// Chantier UX "se rapprocher de Frive/Join" (retour utilisateur, après audit
// COACH_UX_AUDIT.md + AUDIT.md) : "la sélection du temps disponible de la
// semaine" devait être aussi accessible que chez Frive. Avant ce correctif,
// les 7 curseurs vivaient UNIQUEMENT dans le formulaire "Créer un plan"/
// "Nouveau plan" (training-plan-tab.tsx) — alors que bouger un curseur
// écrit déjà en direct dans settings/trainingPreferences (voir
// use-training-preferences.ts) et déclenche déjà le reséquencement glissant
// 7 jours (recalibrateRollingWindow, use-training-plan.ts) SANS jamais
// avoir besoin de cliquer "Générer le plan". La ranger derrière un bouton
// qui sonne comme "créer un nouveau plan" cachait une action qui, en
// réalité, prend effet immédiatement et n'affecte jamais le plan existant
// tant qu'on ne clique pas "Générer". Extrait en carte .lc-card permanente,
// toujours visible en haut de l'onglet Plan (plan actif ou non) — même
// esprit que le rang de curseurs par jour mis en avant chez Join/Frive.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { CalendarClock } from 'lucide-react'

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
  weeklyAvailability: number[]
  weeklyMinutes: number
  onChange: (dayIndex: number, minutes: number) => void
}

export function WeeklyAvailabilityCard({ weeklyAvailability, weeklyMinutes, onChange }: Props) {
  return (
    <Card className="lc-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Disponibilité hebdomadaire</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-data">
            Total : {formatDayMinutes(weeklyMinutes)}/semaine
          </span>
        </div>
        <CardDescription>
          Combien de temps vous avez chaque jour — le plan (nouveau ou en cours) distribue et
          reséquence les séances en fonction de ce qui est réellement disponible, pas d&apos;un
          étalement mécanique. Un changement ici prend effet immédiatement, sans régénérer le plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs text-muted-foreground">{label}</span>
              <Slider
                value={[weeklyAvailability[i]]}
                onValueChange={([v]) => onChange(i, v)}
                min={0}
                max={240}
                step={15}
                className="flex-1"
              />
              <span className="w-14 shrink-0 text-right text-xs font-data text-muted-foreground">
                {formatDayMinutes(weeklyAvailability[i])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
