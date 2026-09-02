"use client"

// ── Vue semaine du calendrier du plan ────────────────────────────────────
//
// Retour utilisateur : "et si on faisait une calendar view? un peu à
// l'exemple de intervals... en donnant un visual de l'activité (avec zone
// de puissance/couleurs) etc pour que l'athlète sache ce qu'il a à faire."
// Une bande de 7 jours (défilement horizontal plutôt qu'une grille 7
// colonnes rigide, illisible sous ~400px de large) — chaque jour coloré
// selon l'intensité de sa séance (réelle si faite, cible si planifiée, voir
// plan-calendar-types.ts). Taper un jour ouvre le détail complet en feuille
// plutôt que de tout dérouler inline — c'est ce qui remplace le long
// scroll d'origine.

import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dumbbell, Wand2, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { PlanSessionDetail } from './plan-session-detail'
import { WorkoutProfileChart } from './workout-profile-chart'
import { sessionZone, type ZoneInfo } from './plan-calendar-types'
import type { PlanWeek, PlanWeekSessionWithValidation, SessionCompletion } from './training-plan-types'
import type { IntervalsActivity } from '@/lib/intervals-api'

interface Props {
  week: PlanWeek
  isGenerating: boolean
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onRegenerate: () => void
  onSend: (session: PlanWeekSessionWithValidation, index: number, dateId: string) => void
  onMoveDate: (index: number, newDate: string) => void
  getCompletion: (session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  /** Pour colorer une séance déjà faite selon son intensité réelle — voir completedRideZone, plan-calendar-types.ts. */
  activities: IntervalsActivity[]
  athleteFtp: number | null | undefined
}

interface DaySession {
  session: PlanWeekSessionWithValidation
  index: number
  completion: SessionCompletion
  zone: ZoneInfo | null
}

export function PlanWeekCalendar({ week, isGenerating, sendingSessionKey, canSendToIntervals, onRegenerate, onSend, onMoveDate, getCompletion, activities, athleteFtp }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  const days = useMemo(() => {
    const weekStart = new Date(`${week.startDate}T00:00:00`)
    return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'))
  }, [week.startDate])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, DaySession[]>()
    for (const day of days) map.set(day, [])
    for (let i = 0; i < (week.sampleSessions ?? []).length; i++) {
      const session = week.sampleSessions![i]
      if (!session.date || !map.has(session.date)) continue
      const completion = getCompletion(session, i)
      map.get(session.date)!.push({ session, index: i, completion, zone: sessionZone(session, completion, activities, athleteFtp) })
    }
    return map
    // getCompletion est recréée à chaque render (useCallback avec des deps
    // qui changent souvent, voir use-training-plan.ts) — recalculer à
    // chaque fois est le comportement correct ici (la complétion peut
    // changer sans que week.sampleSessions change), pas une optimisation à
    // gagner en la retirant des deps.
  }, [days, week.sampleSessions, getCompletion, activities, athleteFtp])

  const selectedDaySessions = selectedDate ? sessionsByDay.get(selectedDate) ?? [] : []
  const hasNoSessionsYet = !week.sampleSessions || week.sampleSessions.length === 0

  return (
    <div className="space-y-3">
      {isGenerating ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Le coach compose les séances type de la semaine...
        </div>
      ) : hasNoSessionsYet ? (
        <div className="flex items-center justify-between gap-2 py-2">
          <p className="text-sm text-muted-foreground">Aucune séance type pour cette semaine pour le moment.</p>
          <Button size="sm" variant="outline" onClick={onRegenerate} className="gap-2 shrink-0">
            <Wand2 className="w-3.5 h-3.5" /> Proposer les séances
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end">
          <Button size="sm" variant="ghost" onClick={onRegenerate} className="gap-1.5 text-xs text-muted-foreground h-7">
            <Wand2 className="w-3 h-3" /> Régénérer
          </Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {days.map((day) => {
          const daySessions = sessionsByDay.get(day) ?? []
          const isToday = day === todayIso
          const hasSessions = daySessions.length > 0
          return (
            <button
              key={day}
              type="button"
              disabled={!hasSessions}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'min-w-[104px] shrink-0 snap-start rounded-xl border p-2.5 text-left transition-colors',
                isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40',
                !hasSessions && 'opacity-60 cursor-default'
              )}
            >
              <p className={cn('text-[10px] uppercase font-bold tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>
                {format(new Date(`${day}T00:00:00`), 'EEE d', { locale: fr })}
              </p>
              <div className="mt-2 space-y-1">
                {daySessions.length === 0 && <p className="text-xs text-muted-foreground/70 italic">Repos</p>}
                {daySessions.map(({ session, completion, zone }, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md px-1.5 py-1 space-y-1',
                      completion.status === 'missed' && 'opacity-60'
                    )}
                    style={session.sessionKind === 'strength' ? undefined : { backgroundColor: zone ? `${zone.color}26` : 'hsl(var(--muted))' }}
                  >
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-medium leading-tight',
                        session.sessionKind === 'strength' && 'text-primary bg-primary/10 rounded px-1 py-0.5 -mx-1'
                      )}
                      style={session.sessionKind === 'strength' ? undefined : { color: zone?.color }}
                    >
                      {/* Retour utilisateur : "on ne sait pas si la séance est
                          effectuée ou pas effectuée ou si elle a été loupée" —
                          la pastille de couleur seule ne le disait pas à ce
                          niveau compact ; icône explicite en plus du
                          traitement opacité/barré déjà en place. */}
                      {completion.status === 'done' && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-primary" />}
                      {completion.status === 'missed' && <XCircle className="w-2.5 h-2.5 shrink-0 text-destructive" />}
                      {session.sessionKind === 'strength' && <Dumbbell className="w-2.5 h-2.5 shrink-0" />}
                      <span className={cn('truncate', completion.status === 'missed' && 'line-through')}>{session.title}</span>
                    </span>
                    {session.sessionKind !== 'strength' && (
                      <WorkoutProfileChart structuredWorkout={session.structuredWorkout} height={12} />
                    )}
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <Sheet open={selectedDate != null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="capitalize">
              {selectedDate && format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM', { locale: fr })}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            {selectedDaySessions.map(({ session, index, completion }) => (
              <PlanSessionDetail
                key={index}
                session={session}
                index={index}
                week={week}
                completion={completion}
                today={todayIso}
                isSending={sendingSessionKey === `${week.weekNumber}-${index}`}
                canSendToIntervals={canSendToIntervals}
                onSend={onSend}
                onMoveDate={onMoveDate}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
