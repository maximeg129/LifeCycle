"use client"

// ── Détail d'une séance type du plan — extrait de WeekSessionsPanel ──────
//
// Retour utilisateur : "et si on faisait une calendar view?" — le contenu
// de cette carte (badges de statut, alimentation, exercices muscu,
// validation S05, sélecteur de date, boutons d'action) existait déjà,
// répété pour chaque séance d'une liste empilée par semaine
// (training-plan-tab.tsx). Extrait tel quel, sans changement de
// comportement, pour être affiché UNE séance à la fois dans la feuille de
// détail ouverte au tap d'un jour du calendrier (plan-week-calendar.tsx)
// plutôt que dans un accordéon de liste.

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Apple, Dumbbell, PlayCircle, CheckCircle2, XCircle, ShieldAlert, CalendarClock } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { LogStrengthSessionDialog } from './log-strength-session-dialog'
import { LiveStrengthSessionView } from './live-strength-session-view'
import { WorkoutProfileChart } from './workout-profile-chart'
import { nextAvailableWeekDate, type PlanWeek, type PlanWeekSessionWithValidation, type SessionCompletion } from './training-plan-types'

interface Props {
  session: PlanWeekSessionWithValidation
  index: number
  week: PlanWeek
  completion: SessionCompletion
  /** yyyy-MM-dd — pour proposer un jour de report qui ne soit jamais dans le passé (voir "Reprogrammer" ci-dessous). */
  today: string
  isSending: boolean
  canSendToIntervals: boolean
  onSend: (session: PlanWeekSessionWithValidation, index: number, dateId: string) => void
  onMoveDate: (index: number, newDate: string) => void
}

export function PlanSessionDetail({ session, index, week, completion, today, isSending, canSendToIntervals, onSend, onMoveDate }: Props) {
  // Retour utilisateur : "un système de suivi de la seance a la salle, avec
  // chronometre, temps de repos" — vue plein écran gardée en state local
  // plutôt qu'un Dialog. Local à CETTE carte (pas au niveau semaine comme
  // avant l'extraction) : dans la vue calendrier, une seule séance est
  // visible à la fois (la feuille de détail du jour tapé), donc plus besoin
  // de partager cet état entre plusieurs cartes d'une même liste.
  const [liveOpen, setLiveOpen] = useState(false)

  // Retour utilisateur : "il faudrait sûrement pouvoir donner la
  // possibilité de, si une séance est loupée, [la] remettre quelque part
  // dans la semaine" — premier jour disponible à partir de DEMAIN (jamais
  // un jour déjà passé), qui n'est pas déjà pris par une autre séance de
  // cette semaine. Null si la semaine est déjà pleine à partir de demain —
  // le bouton se désactive plutôt que de proposer un repli inventé.
  const rescheduleDate = nextAvailableWeekDate(
    week,
    week.sampleSessions ?? [],
    index,
    format(addDays(new Date(`${today}T00:00:00`), 1), 'yyyy-MM-dd')
  )

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {session.date && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {format(new Date(`${session.date}T00:00:00`), 'EEEE d MMM', { locale: fr })}
              </Badge>
            )}
            <p className="text-sm font-medium">{session.title}</p>
            {completion.status === 'done' && (
              <Badge className="text-[10px] gap-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                <CheckCircle2 className="w-3 h-3" /> Réalisée{completion.actualDurationMinutes != null ? ` · ${Math.round(completion.actualDurationMinutes)}min` : ''}
              </Badge>
            )}
            {completion.status === 'missed' && (
              <>
                <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive bg-destructive/5">
                  <XCircle className="w-3 h-3" /> Manquée
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rescheduleDate && onMoveDate(index, rescheduleDate)}
                  disabled={!rescheduleDate}
                  className="h-6 px-2 text-[10px] gap-1"
                  title={rescheduleDate ? `Déplacer au ${format(new Date(`${rescheduleDate}T00:00:00`), 'EEEE d MMM', { locale: fr })}` : 'Aucun jour libre restant cette semaine — choisissez une date ci-dessous'}
                >
                  <CalendarClock className="w-3 h-3" /> Reprogrammer
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{session.rationale}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px]">{session.intensityLabel}</Badge>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{session.durationMinutes} min</span>
        </div>
      </div>
      {(!session.sessionKind || session.sessionKind === 'cycling') && (
        <WorkoutProfileChart structuredWorkout={session.structuredWorkout} height={48} />
      )}
      {session.fueling && session.fueling.neededOnBike && (!session.sessionKind || session.sessionKind === 'cycling') && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <Apple className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium">
              {session.fueling.carbGramsPerHourMin}
              {session.fueling.carbGramsPerHourMax != null && session.fueling.carbGramsPerHourMax !== session.fueling.carbGramsPerHourMin ? `–${session.fueling.carbGramsPerHourMax}` : ''}
              {' '}g de glucides/h
            </p>
            {session.fueling.hydrationNote && <p className="text-muted-foreground">{session.fueling.hydrationNote}</p>}
          </div>
        </div>
      )}
      {session.sessionKind === 'strength' && session.strengthExercises && session.strengthExercises.length > 0 && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <Dumbbell className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {session.strengthExercises.map((ex, exIndex) => (
              <li key={exIndex}>
                <span className="font-medium">{ex.name}</span> : {ex.sets}x{ex.reps} — {ex.loadGuidance}
                {ex.restSeconds ? ` (repos ${ex.restSeconds}s)` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {session.sessionKind === 'strength' && session.strengthValidation?.isMaintenanceOnly && (
        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 bg-amber-500/5 w-fit">
          {session.sessionType === 'entretien' ? 'Entretien' : 'Top-up'} — pas la séance principale de la semaine
        </Badge>
      )}
      {session.strengthValidation && session.strengthValidation.overallVerdict !== 'ok' && (
        <div
          className={cn(
            'flex items-start gap-2 p-2 rounded-lg border text-xs',
            session.strengthValidation.overallVerdict === 'blocked' ? 'bg-destructive/5 border-destructive/20' : 'bg-yellow-500/5 border-yellow-500/20'
          )}
        >
          <ShieldAlert className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', session.strengthValidation.overallVerdict === 'blocked' ? 'text-destructive' : 'text-yellow-500')} />
          <div className="space-y-0.5">
            <p className="font-medium">
              {session.strengthValidation.overallVerdict === 'blocked' ? 'Séance incomplète — ne respecte pas la grille S05' : 'À vérifier (grille S05)'}
            </p>
            <ul className="space-y-0.5 text-muted-foreground list-disc pl-4">
              {session.strengthValidation.results
                .filter((r) => r.verdict === 'block' || r.verdict === 'warn')
                .map((r, i) => <li key={i}>{r.detail}</li>)}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Retour utilisateur : "en drag and drop ou en ajustant la date de
            modifier le plan" — sélecteur de date tap-friendly plutôt qu'un
            vrai glisser-déposer tactile (choix explicite : plus fiable sur
            mobile, pas de nouvelle dépendance). */}
        <Input
          type="date"
          value={session.date ?? week.startDate}
          min={week.startDate}
          max={week.endDate}
          onChange={(e) => onMoveDate(index, e.target.value)}
          className="h-8 w-auto text-xs"
          aria-label={`Jour de la séance "${session.title}"`}
        />
        <Button
          size="sm"
          onClick={() => onSend(session, index, session.date ?? week.startDate)}
          disabled={isSending || !canSendToIntervals}
          className="gap-1.5 h-8"
          title={canSendToIntervals ? undefined : 'Renseignez vos identifiants Intervals.icu dans Réglages'}
        >
          {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Envoyer sur Intervals.icu
        </Button>
        {session.sessionKind === 'strength' && session.strengthExercises && session.strengthExercises.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setLiveOpen(true)} className="gap-1.5 h-8">
            <PlayCircle className="w-3.5 h-3.5" /> Démarrer la séance
          </Button>
        )}
        {session.sessionKind === 'strength' && <LogStrengthSessionDialog session={session} weekNumber={week.weekNumber} sessionIndex={index} />}
      </div>
      {liveOpen && (
        <LiveStrengthSessionView
          session={session}
          weekNumber={week.weekNumber}
          sessionIndex={index}
          sessionKey={`${week.weekNumber}-${index}`}
          onClose={() => setLiveOpen(false)}
        />
      )}
    </div>
  )
}
