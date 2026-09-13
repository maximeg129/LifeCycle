"use client"

// ── Prochains entraînements — bande glissante Aujourd'hui + 6 jours ──────
//
// Chantier UX "se rapprocher de Frive/Join" (retour utilisateur, après
// audit COACH_UX_AUDIT.md/AUDIT.md) : "la vue des prochains entraînements
// (à caler sur Frive)". PlanWeekCalendar (juste à côté) reste figé sur la
// semaine calendaire Lundi-Dimanche SÉLECTIONNÉE dans PlanOverviewGrid —
// exactement ce qu'il faut pour parcourir/gérer une semaine précise du
// plan (l'écran de gestion occasionnel, voir COACH_UX_AUDIT.md), mais pas
// pour le coup d'œil quotidien "qu'est-ce qui m'attend". Ce composant
// répond à ce second besoin : toujours ancré sur AUJOURD'HUI (jamais sur
// une semaine sélectionnée), via sessionsForRollingWindow (training-plan-
// types.ts, chantier A) — la fenêtre peut chevaucher deux semaines
// calendaires, gérée transparemment (chaque jour porte sa propre semaine).
// Affiché en permanence en haut de l'onglet Plan, sans rien sélectionner.

import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dumbbell, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { PlanSessionDetail } from './plan-session-detail'
import { WorkoutProfileChart } from './workout-profile-chart'
import { sessionZone } from './plan-calendar-types'
import { sessionsForRollingWindow, type PlanWeek, type PlanWeekSessionWithValidation, type SessionCompletion } from './training-plan-types'
import type { IntervalsActivity } from '@/lib/intervals-api'

interface Props {
  weeks: PlanWeek[]
  todayIso: string
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onSend: (session: PlanWeekSessionWithValidation, week: PlanWeek, index: number, dateId: string) => void
  onMoveDate: (week: PlanWeek, index: number, newDate: string) => void
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  activities: IntervalsActivity[]
  athleteFtp: number | null | undefined
  adjustingLocationKey: string | null
  onAdjustLocation: (week: PlanWeek, index: number, targetLocation: 'indoor' | 'outdoor') => void
}

export function PlanRollingCalendar({ weeks, todayIso, sendingSessionKey, canSendToIntervals, onSend, onMoveDate, getCompletion, activities, athleteFtp, adjustingLocationKey, onAdjustLocation }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const tomorrowIso = format(addDays(new Date(`${todayIso}T00:00:00`), 1), 'yyyy-MM-dd')

  const days = sessionsForRollingWindow(weeks, todayIso)
  const selectedDay = selectedDate ? days.find((d) => d.date === selectedDate) ?? null : null

  const dayLabel = (date: string) => {
    if (date === todayIso) return "Aujourd'hui"
    if (date === tomorrowIso) return 'Demain'
    return format(new Date(`${date}T00:00:00`), 'EEE d', { locale: fr })
  }

  return (
    <Card className="lc-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prochains entraînements</CardTitle>
        <CardDescription>Vos 7 prochains jours, toujours ancrés sur aujourd&apos;hui.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
          {days.map(({ date, week, sessions }) => {
            const isToday = date === todayIso
            const hasSessions = sessions.length > 0
            return (
              <button
                key={date}
                type="button"
                disabled={!hasSessions}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'min-w-[104px] shrink-0 snap-start rounded-xl border p-2.5 text-left transition-colors',
                  isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/40',
                  !hasSessions && 'opacity-60 cursor-default'
                )}
              >
                <p className={cn('text-[10px] uppercase font-bold tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {dayLabel(date)}
                </p>
                <div className="mt-2 space-y-1">
                  {sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground/70 italic">
                      {week?.sampleSessions ? 'Repos' : 'Plan pas encore composé'}
                    </p>
                  )}
                  {sessions.map(({ session, index }, i) => {
                    const completion = week ? getCompletion(week, session, index) : { status: 'unscheduled' as const }
                    const zone = sessionZone(session, completion, activities, athleteFtp)
                    return (
                      <div
                        key={i}
                        className={cn('rounded-md px-1.5 py-1 space-y-1', completion.status === 'missed' && 'opacity-60')}
                        style={session.sessionKind === 'strength' ? undefined : { backgroundColor: zone ? `${zone.color}26` : 'hsl(var(--muted))' }}
                      >
                        <span
                          className={cn(
                            'flex items-center gap-1 text-[10px] font-medium leading-tight',
                            session.sessionKind === 'strength' && 'text-primary bg-primary/10 rounded px-1 py-0.5 -mx-1'
                          )}
                          style={session.sessionKind === 'strength' ? undefined : { color: zone?.color }}
                        >
                          {completion.status === 'done' && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-primary" />}
                          {completion.status === 'missed' && <XCircle className="w-2.5 h-2.5 shrink-0 text-destructive" />}
                          {session.sessionKind === 'strength' && <Dumbbell className="w-2.5 h-2.5 shrink-0" />}
                          <span className={cn('truncate', completion.status === 'missed' && 'line-through')}>{session.title}</span>
                        </span>
                        {session.sessionKind !== 'strength' && (
                          <WorkoutProfileChart structuredWorkout={session.structuredWorkout} height={12} />
                        )}
                      </div>
                    )
                  })}
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
              {selectedDay?.week && selectedDay.sessions.map(({ session, index }) => (
                <PlanSessionDetail
                  key={index}
                  session={session}
                  index={index}
                  week={selectedDay.week!}
                  completion={getCompletion(selectedDay.week!, session, index)}
                  today={todayIso}
                  isSending={sendingSessionKey === `${selectedDay.week!.weekNumber}-${index}`}
                  canSendToIntervals={canSendToIntervals}
                  onSend={(s, i, dateId) => onSend(s, selectedDay.week!, i, dateId)}
                  onMoveDate={(i, newDate) => onMoveDate(selectedDay.week!, i, newDate)}
                  isAdjustingLocation={adjustingLocationKey === `${selectedDay.week!.weekNumber}-${index}`}
                  onAdjustLocation={(targetLocation) => onAdjustLocation(selectedDay.week!, index, targetLocation)}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  )
}
