"use client"

// ── WeekStrip — séance du jour + 7 prochains jours, séances passées en pull ──
//
// Restructuration complète (lifecycle-ui-reference.html, voir CLAUDE.md) —
// ⚠️ reprend la forme "liste verticale" de ce composant (voir CLAUDE.md
// "Plan v2"/"Plan : séance du jour + 7 prochains jours... remplace la
// liste Lundi-Dimanche") pour revenir à des tuiles compactes de jour
// (`.week`/`.day` de la référence), exactement comme `plan-week-
// calendar.tsx` le fait déjà pour UNE semaine sélectionnée — ce fichier
// adapte ce MÊME patron (tuile compacte + Sheet de détail au tap) à la
// fenêtre glissante multi-semaines (sessionsForNext7Days). Décision
// assumée : la référence HTML EST le mandat explicite de cette
// restructuration, qui prime sur le choix "liste" acté deux fois
// auparavant sous un brief antérieur.
//
// Deux fonctionnalités de la version "liste" conservées sans changement :
// 1. Fenêtre glissante ancrée sur aujourd'hui (sessionsForNext7Days,
//    training-plan-types.ts), pas la semaine calendaire Lundi-Dimanche —
//    peut chevaucher deux semaines du plan (la semaine suivante restant
//    lazy, voir "vue calendrier v2").
// 2. Séances déjà passées révélées via "Voir les séances passées"
//    (pastPlanSessions) — Collapsible, inchangé.

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChevronDown, History, Loader2, Wand2, Dumbbell, CheckCircle2, XCircle } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PlanSessionDetail } from './plan-session-detail'
import { WorkoutProfileChart } from './workout-profile-chart'
import { sessionZone, type ZoneInfo } from './plan-calendar-types'
import {
  groupRollingDaysByWeek,
  pastPlanSessions,
  sessionsForNext7Days,
  type PlanWeek,
  type PlanWeekSessionWithValidation,
  type SessionCompletion,
} from './training-plan-types'
import type { IntervalsActivity } from '@/lib/intervals-api'
import type { StrengthExercise } from '@/ai/flows/strength-exercise-schema'

interface Props {
  weeks: PlanWeek[]
  today: string
  /** Masque le jour "Aujourd'hui" de la fenêtre glissante — quand la séance du jour vit déjà ailleurs à l'écran (voir training-plan-tab.tsx : DailyWorkoutTab), jamais montrée deux fois. */
  hideToday?: boolean
  generatingSessionsForWeek: number | null
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onRegenerate: (week: PlanWeek) => void
  onSend: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number, dateId: string) => void
  onMoveDate: (week: PlanWeek, index: number, newDate: string) => void
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  adjustingLocationKey: string | null
  onAdjustLocation: (week: PlanWeek, index: number, targetLocation: 'indoor' | 'outdoor') => void
  /** Retour utilisateur : "rajouter des exercices, et des tour pour chaque exercice dans la musculation" — avant de démarrer, voir plan-session-detail.tsx. */
  onAddExercise: (week: PlanWeek, index: number, exercise: StrengthExercise) => void
  onAddExerciseSet: (week: PlanWeek, index: number, exerciseIndex: number) => void
  /** Pour colorer une séance déjà faite selon son intensité réelle — voir completedRideZone, plan-calendar-types.ts. Même donnée déjà fetchée pour le Plan (use-training-plan.ts), aucun nouveau fetch. */
  activities: IntervalsActivity[]
  athleteFtp: number | null | undefined
}

function dayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) return "Aujourd'hui"
  const tomorrow = format(addDays(new Date(`${todayIso}T00:00:00`), 1), 'yyyy-MM-dd')
  if (dateIso === tomorrow) return 'Demain'
  return format(new Date(`${dateIso}T00:00:00`), 'EEE d', { locale: fr })
}

interface TileSession {
  week: PlanWeek
  session: PlanWeekSessionWithValidation
  index: number
  completion: SessionCompletion
  zone: ZoneInfo | null
}

export function PlanNextSessionsList({
  weeks, today, hideToday, generatingSessionsForWeek, sendingSessionKey, canSendToIntervals,
  onRegenerate, onSend, onMoveDate, getCompletion, adjustingLocationKey, onAdjustLocation,
  onAddExercise, onAddExerciseSet, activities, athleteFtp,
}: Props) {
  const [showPast, setShowPast] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const days = useMemo(() => sessionsForNext7Days(weeks, today), [weeks, today])
  const visibleDays = useMemo(() => (hideToday ? days.filter((d) => d.date !== today) : days), [days, hideToday, today])
  const segments = useMemo(() => groupRollingDaysByWeek(visibleDays), [visibleDays])
  const past = useMemo(() => pastPlanSessions(weeks, today), [weeks, today])

  // Tuiles par jour — même patron que plan-week-calendar.tsx (une seule
  // semaine) adapté à la fenêtre glissante (plusieurs semaines possibles,
  // chaque séance porte déjà sa propre `week` depuis sessionsForNext7Days).
  const tilesByDate = useMemo(() => {
    const map = new Map<string, TileSession[]>()
    for (const day of visibleDays) {
      map.set(
        day.date,
        day.sessions.map(({ week, session, index }) => {
          const completion = getCompletion(week, session, index)
          return { week, session, index, completion, zone: sessionZone(session, completion, activities, athleteFtp) }
        })
      )
    }
    return map
    // getCompletion est recréée à chaque render (voir plan-week-calendar.tsx,
    // même commentaire) — recalculer à chaque fois est correct ici.
  }, [visibleDays, getCompletion, activities, athleteFtp])

  const ungeneratedSegment = segments.find((s) => s.weekNotGenerated)
  const selectedDaySessions = selectedDate ? tilesByDate.get(selectedDate) ?? [] : []
  const selectedWeekNotGenerated = selectedDate ? visibleDays.find((d) => d.date === selectedDate)?.weekNotGenerated : false

  return (
    <div className="space-y-4">
      {past.length > 0 && (
        <Collapsible open={showPast} onOpenChange={setShowPast}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <History className="w-3.5 h-3.5" /> Voir les séances passées ({past.length})
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showPast && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {past.map(({ week, session, index }) => (
              <PlanSessionDetail
                key={`${week.weekNumber}-${index}`}
                session={session}
                index={index}
                week={week}
                completion={getCompletion(week, session, index)}
                today={today}
                isSending={sendingSessionKey === `${week.weekNumber}-${index}`}
                canSendToIntervals={canSendToIntervals}
                onSend={(s, i, dateId) => onSend(week, s, i, dateId)}
                onMoveDate={(i, newDate) => onMoveDate(week, i, newDate)}
                isAdjustingLocation={adjustingLocationKey === `${week.weekNumber}-${index}`}
                onAdjustLocation={(targetLocation) => onAdjustLocation(week, index, targetLocation)}
                onAddExercise={(exercise) => onAddExercise(week, index, exercise)}
                onAddExerciseSet={(exerciseIndex) => onAddExerciseSet(week, index, exerciseIndex)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{hideToday ? 'Cette semaine' : 'Prochains jours'}</h3>
          {visibleDays.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(`${visibleDays[0].date}T00:00:00`), 'dd MMM', { locale: fr })} – {format(new Date(`${visibleDays.at(-1)!.date}T00:00:00`), 'dd MMM', { locale: fr })}
            </span>
          )}
        </div>

        {/* Bande de tuiles — même largeur/style que plan-week-calendar.tsx, pour une seule et même convention visuelle dans toute l'app. */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
          {visibleDays.map((day) => {
            const tiles = tilesByDate.get(day.date) ?? []
            const isToday = day.date === today
            const hasSessions = tiles.length > 0
            const disabled = !hasSessions && !day.weekNotGenerated
            return (
              <button
                key={day.date}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  'min-w-[104px] shrink-0 snap-start rounded-xl border p-2.5 text-left transition-colors',
                  isToday ? 'border-primary/50 bg-primary/5' : day.weekNotGenerated ? 'border-dashed border-border bg-transparent' : 'border-border bg-card/40',
                  disabled && 'opacity-60 cursor-default'
                )}
              >
                <p className={cn('text-xs uppercase font-bold tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {dayLabel(day.date, today)}
                </p>
                <div className="mt-2 space-y-1">
                  {day.weekNotGenerated ? (
                    <p className="text-xs text-muted-foreground/70 italic">Pas encore composé</p>
                  ) : tiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 italic">Repos</p>
                  ) : (
                    tiles.map(({ session, completion, zone }, i) => (
                      <div
                        key={i}
                        className={cn('rounded-md px-1.5 py-1 space-y-1', completion.status === 'missed' && 'opacity-60')}
                        style={session.sessionKind === 'strength' ? undefined : { backgroundColor: zone ? `${zone.color}26` : 'hsl(var(--muted))' }}
                      >
                        <span
                          className={cn(
                            'flex items-center gap-1 text-xs font-medium leading-tight',
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
                    ))
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Un seul bouton "Proposer les séances" pour tout le segment pas
            encore composé, plutôt qu'un par jour — la fenêtre glissante
            n'en couvre jamais plus d'un à la fois (seule la semaine
            suivante peut être lazy, voir plus haut). */}
        {ungeneratedSegment && (
          <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl border border-dashed border-border">
            <p className="text-xs text-muted-foreground">Semaine {ungeneratedSegment.weekNumber} pas encore composée.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRegenerate(ungeneratedSegment.days[0].week!)}
              disabled={generatingSessionsForWeek === ungeneratedSegment.weekNumber}
              className="gap-2 shrink-0"
            >
              {generatingSessionsForWeek === ungeneratedSegment.weekNumber ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Proposer les séances
            </Button>
          </div>
        )}
      </div>

      <Sheet open={selectedDate != null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="capitalize">
              {selectedDate && format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM', { locale: fr })}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            {selectedWeekNotGenerated ? (
              <p className="text-sm text-muted-foreground">Cette semaine n&apos;a pas encore été composée.</p>
            ) : (
              selectedDaySessions.map(({ week, session, index, completion }) => (
                <PlanSessionDetail
                  key={`${week.weekNumber}-${index}`}
                  session={session}
                  index={index}
                  week={week}
                  completion={completion}
                  today={today}
                  isSending={sendingSessionKey === `${week.weekNumber}-${index}`}
                  canSendToIntervals={canSendToIntervals}
                  onSend={(s, i, dateId) => onSend(week, s, i, dateId)}
                  onMoveDate={(i, newDate) => onMoveDate(week, i, newDate)}
                  isAdjustingLocation={adjustingLocationKey === `${week.weekNumber}-${index}`}
                  onAdjustLocation={(targetLocation) => onAdjustLocation(week, index, targetLocation)}
                  onAddExercise={(exercise) => onAddExercise(week, index, exercise)}
                  onAddExerciseSet={(exerciseIndex) => onAddExerciseSet(week, index, exerciseIndex)}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
