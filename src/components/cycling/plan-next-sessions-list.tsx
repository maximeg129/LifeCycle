"use client"

// ── Séance du jour + 7 prochains jours, séances passées en pull ─────────
//
// Retour utilisateur, remplace la liste "Séances de la semaine" (Lundi-
// Dimanche, façon Frive — voir CLAUDE.md "Refonte UX v2") : "j'aimerais que
// l'on voit la séance du jour et des 7 prochains jours sur cette vue, les
// séances passées devraient être accessibles en pull vers le bas qui ferait
// apparaître les séances passées, donc on ne verrait pas séance de la
// semaine mais séances des 7 prochains jours." Deux changements :
// 1. La liste principale suit désormais une fenêtre glissante ancrée sur
//    aujourd'hui (sessionsForNext7Days, training-plan-types.ts) plutôt que
//    la semaine calendaire Lundi-Dimanche — peut chevaucher deux semaines
//    du plan (la semaine suivante restant lazy, voir "vue calendrier v2" :
//    un segment "pas encore composée" avec un bouton dédié plutôt qu'un
//    graphique/appel IA inventé pour ces jours-là).
// 2. Les séances déjà passées ne sont plus dans cette liste — révélées via
//    un bouton "Voir les séances passées" (pastPlanSessions), même
//    mécanique Collapsible que "Sorties depuis le montage" (Chaînes) :
//    décision explicite (AskUserQuestion) contre un vrai geste de
//    glissement tactile, cohérente avec "tap-friendly plutôt qu'un vrai
//    glisser-déposer tactile" déjà acté ailleurs dans ce fichier pour le
//    déplacement de séance.
//
// Réutilise PlanSessionDetail tel quel pour chaque séance (détail complet :
// statut, alimentation, exercices muscu, toggle intérieur/extérieur,
// sélecteur de date, bouton d'envoi) — même discipline "réutiliser les
// briques déjà en place" que l'ancienne liste hebdomadaire.

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, History, Loader2, Wand2 } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PlanSessionDetail } from './plan-session-detail'
import {
  groupRollingDaysByWeek,
  pastPlanSessions,
  sessionsForNext7Days,
  type PlanWeek,
  type PlanWeekSessionWithValidation,
  type SessionCompletion,
} from './training-plan-types'

interface Props {
  weeks: PlanWeek[]
  today: string
  generatingSessionsForWeek: number | null
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onRegenerate: (week: PlanWeek) => void
  onSend: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number, dateId: string) => void
  onMoveDate: (week: PlanWeek, index: number, newDate: string) => void
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  adjustingLocationKey: string | null
  onAdjustLocation: (week: PlanWeek, index: number, targetLocation: 'indoor' | 'outdoor') => void
}

function dayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) return "Aujourd'hui"
  const tomorrow = format(addDays(new Date(`${todayIso}T00:00:00`), 1), 'yyyy-MM-dd')
  if (dateIso === tomorrow) return 'Demain'
  return format(new Date(`${dateIso}T00:00:00`), 'EEEE d MMM', { locale: fr })
}

export function PlanNextSessionsList({
  weeks, today, generatingSessionsForWeek, sendingSessionKey, canSendToIntervals,
  onRegenerate, onSend, onMoveDate, getCompletion, adjustingLocationKey, onAdjustLocation,
}: Props) {
  const [showPast, setShowPast] = useState(false)

  const days = useMemo(() => sessionsForNext7Days(weeks, today), [weeks, today])
  const segments = useMemo(() => groupRollingDaysByWeek(days), [days])
  const past = useMemo(() => pastPlanSessions(weeks, today), [weeks, today])

  const renderDetail = (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => (
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
    />
  )

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
            {past.map(({ week, session, index }) => renderDetail(week, session, index))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Prochains jours</h3>
          <span className="text-xs text-muted-foreground">
            {format(new Date(`${days[0].date}T00:00:00`), 'dd MMM', { locale: fr })} – {format(new Date(`${days.at(-1)!.date}T00:00:00`), 'dd MMM', { locale: fr })}
          </span>
        </div>

        {segments.map((segment) => {
          if (segment.weekNotGenerated) {
            const week = segment.days[0].week!
            const isGenerating = generatingSessionsForWeek === week.weekNumber
            return (
              <div key={`ungenerated-${segment.weekNumber}`} className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl border border-dashed border-border">
                <p className="text-xs text-muted-foreground">
                  Semaine {segment.weekNumber} pas encore composée ({format(new Date(`${segment.days[0].date}T00:00:00`), 'dd MMM', { locale: fr })}
                  {segment.days.length > 1 && ` – ${format(new Date(`${segment.days.at(-1)!.date}T00:00:00`), 'dd MMM', { locale: fr })}`}).
                </p>
                <Button size="sm" variant="outline" onClick={() => onRegenerate(week)} disabled={isGenerating} className="gap-2 shrink-0">
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Proposer les séances
                </Button>
              </div>
            )
          }

          return segment.days.map((day) => (
            <div key={day.date} className="space-y-1.5">
              <span className="text-xs font-semibold capitalize text-muted-foreground">{dayLabel(day.date, today)}</span>
              {day.sessions.length === 0 ? (
                <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl border border-border/60 bg-muted/20">
                  <span className="text-xs text-muted-foreground">Aucune séance prévue</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {day.sessions.map(({ week, session, index }) => renderDetail(week, session, index))}
                </div>
              )}
            </div>
          ))
        })}
      </div>
    </div>
  )
}
