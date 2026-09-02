"use client"

// ── Grille compacte du plan entier ───────────────────────────────────────
//
// Retour utilisateur : "c'est pas idéal encore des long scroll beaucoup
// d'info et on peut se perdre... un peu à l'exemple de intervals". La vue
// semaine (plan-week-calendar.tsx) montre une semaine à la fois en détail ;
// cette grille donne l'orientation inverse — TOUT le plan d'un coup d'œil,
// une ligne compacte par semaine avec 7 petites pastilles de couleur, pour
// naviguer directement à la semaine voulue sans dérouler 12 cartes à la
// suite. Une semaine pas encore générée (sampleSessions lazy, voir
// training-plan-types.ts) affiche des pastilles neutres plutôt que
// d'inventer un contenu — honnête sur ce qui a réellement été composé.

import { useMemo } from 'react'
import { addDays, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { sessionZone } from './plan-calendar-types'
import type { PlanPhase, PlanWeek, PlanWeekSessionWithValidation, SessionCompletion } from './training-plan-types'
import type { IntervalsActivity } from '@/lib/intervals-api'

const PHASE_DOT_CLASS: Record<PlanPhase, string> = {
  base: 'bg-blue-500',
  build: 'bg-orange-500',
  peak: 'bg-red-500',
  taper: 'bg-purple-500',
  recovery: 'bg-green-500',
}

interface Props {
  weeks: PlanWeek[]
  selectedWeekNumber: number | null
  onSelectWeek: (weekNumber: number) => void
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  activities: IntervalsActivity[]
  athleteFtp: number | null | undefined
}

export function PlanOverviewGrid({ weeks, selectedWeekNumber, onSelectWeek, getCompletion, activities, athleteFtp }: Props) {
  return (
    <div className="space-y-1">
      {weeks.map((week) => (
        <WeekRow
          key={week.weekNumber}
          week={week}
          isSelected={week.weekNumber === selectedWeekNumber}
          onSelect={() => onSelectWeek(week.weekNumber)}
          getCompletion={getCompletion}
          activities={activities}
          athleteFtp={athleteFtp}
        />
      ))}
    </div>
  )
}

function WeekRow({ week, isSelected, onSelect, getCompletion, activities, athleteFtp }: {
  week: PlanWeek
  isSelected: boolean
  onSelect: () => void
  getCompletion: Props['getCompletion']
  activities: IntervalsActivity[]
  athleteFtp: number | null | undefined
}) {
  const days = useMemo(() => {
    const weekStart = new Date(`${week.startDate}T00:00:00`)
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
  }, [week.startDate])

  const colorByDay = useMemo(() => {
    const map = new Map<string, string | 'strength' | null>()
    for (const day of days) map.set(day, null)
    for (let i = 0; i < (week.sampleSessions ?? []).length; i++) {
      const session = week.sampleSessions![i]
      if (!session.date || !map.has(session.date)) continue
      if (session.sessionKind === 'strength') {
        map.set(session.date, 'strength')
        continue
      }
      const completion = getCompletion(week, session, i)
      const zone = sessionZone(session, completion, activities, athleteFtp)
      map.set(session.date, zone?.color ?? null)
    }
    return map
  }, [days, week, getCompletion, activities, athleteFtp])

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors',
        isSelected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/40'
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0 w-14">
        <span className={cn('w-1.5 h-1.5 rounded-full', PHASE_DOT_CLASS[week.phase])} />
        <span className="text-xs font-medium">S{week.weekNumber}</span>
      </div>
      <div className="flex gap-1 shrink-0">
        {days.map((day) => {
          const color = colorByDay.get(day)
          return (
            <span
              key={day}
              className={cn('w-2.5 h-2.5 rounded-[3px]', color == null && 'bg-muted')}
              style={color && color !== 'strength' ? { backgroundColor: color } : color === 'strength' ? { backgroundColor: 'hsl(var(--primary))' } : undefined}
            />
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{week.focus}</p>
      <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{Math.round(week.targetWeeklyMinutes / 60 * 10) / 10}h</p>
    </button>
  )
}
