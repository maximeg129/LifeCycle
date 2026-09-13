"use client"

// ── Adhérence prévu/réalisé — graphique compact plusieurs semaines ───────
//
// COACH_UX_AUDIT.md §4.C, jamais construit jusqu'ici : "Pas de vue
// 'semaine : prévu vs réalisé' en un graphique. Le Calendrier TrainerRoad
// épingle prévu/réalisé sur le même graphique. LifeCycle a l'équivalent en
// DEUX affichages séparés (badges par séance + courbe PMC) — jamais une
// vue compacte au même endroit." Barres empilées à la main (CSS/SVG, pas
// Recharts) — même convention que WorkoutProfileChart/RingGauge pour un
// widget compact : fond = minutes prévues, avant-plan = minutes
// réellement réalisées (capé visuellement à 100% de la barre de fond,
// jamais un dépassement visuel trompeur — le chiffre exact reste dans le
// texte sous la barre).

import { computeWeeklyAdherence, type PlanWeek, type PlanWeekSessionWithValidation, type SessionCompletion } from './training-plan-types'

interface Props {
  weeks: PlanWeek[]
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  todayIso: string
}

export function PlanAdherenceChart({ weeks, getCompletion, todayIso }: Props) {
  const data = computeWeeklyAdherence(weeks, getCompletion, todayIso)
  if (data.length === 0) return null

  const maxMinutes = Math.max(...data.map((w) => Math.max(w.plannedMinutes, w.completedMinutes)), 1)
  const totalPlanned = data.reduce((sum, w) => sum + w.sessionsPlanned, 0)
  const totalDone = data.reduce((sum, w) => sum + w.sessionsDone, 0)

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {totalDone}/{totalPlanned} séances réalisées sur les {data.length} dernière{data.length > 1 ? 's' : ''} semaine{data.length > 1 ? 's' : ''} du plan.
      </p>
      <div className="flex items-end gap-3 h-28">
        {data.map((w) => {
          const plannedPct = Math.max(4, Math.round((w.plannedMinutes / maxMinutes) * 100))
          const completedPct = Math.min(plannedPct, Math.round((w.completedMinutes / maxMinutes) * 100))
          return (
            <div key={w.weekNumber} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="relative w-full max-w-[28px] rounded-md bg-muted overflow-hidden" style={{ height: '80px' }}>
                <div className="absolute inset-x-0 bottom-0 bg-border" style={{ height: `${plannedPct}%` }} />
                <div className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: `${completedPct}%` }} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">S{w.weekNumber}</span>
              <span className="text-[9px] text-muted-foreground/70 font-data">{w.sessionsDone}/{w.sessionsPlanned}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-border inline-block" /> Prévu</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary inline-block" /> Réalisé</span>
      </div>
    </div>
  )
}
