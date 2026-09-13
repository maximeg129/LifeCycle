"use client"

// ── Séances de la semaine — liste verticale façon Frive ──────────────────
//
// Retour utilisateur, capture d'écran Frive à l'appui : "chaque séance de
// la semaine en liste comme frive avec le detail et le toggle pour indoor/
// outdoor." Remplace la bande glissante "Prochains entraînements"
// (PlanRollingCalendar, chantier précédent — supprimée, voir CLAUDE.md) :
// plus un coup d'oeil compact ancré sur aujourd'hui, mais la liste complète
// des séances de la semaine COURANTE, une carte détaillée par séance —
// exactement ce que montre Frive.
//
// Réutilise PlanSessionDetail tel quel pour chaque ligne (détail complet :
// statut, alimentation, exercices muscu, toggle intérieur/extérieur déjà
// intégré, sélecteur de date, bouton d'envoi) plutôt que de reconstruire
// une carte de séance depuis zéro — même discipline "réutiliser les
// briques déjà en place" que le reste de ce fichier.

import { Button } from '@/components/ui/button'
import { Loader2, Wand2 } from 'lucide-react'
import { PlanSessionDetail } from './plan-session-detail'
import type { PlanWeek, PlanWeekSessionWithValidation, SessionCompletion } from './training-plan-types'

interface Props {
  week: PlanWeek
  today: string
  isGenerating: boolean
  sendingSessionKey: string | null
  canSendToIntervals: boolean
  onRegenerate: () => void
  onSend: (session: PlanWeekSessionWithValidation, index: number, dateId: string) => void
  onMoveDate: (index: number, newDate: string) => void
  getCompletion: (session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  adjustingLocationKey: string | null
  onAdjustLocation: (index: number, targetLocation: 'indoor' | 'outdoor') => void
}

export function PlanWeekSessionList({ week, today, isGenerating, sendingSessionKey, canSendToIntervals, onRegenerate, onSend, onMoveDate, getCompletion, adjustingLocationKey, onAdjustLocation }: Props) {
  const sessions = week.sampleSessions ?? []
  const hasNoSessionsYet = sessions.length === 0

  // Ordre chronologique, comme Frive — assignSessionDatesByAvailability ne
  // garantit pas que l'ordre du tableau suive les dates (bin-packing par
  // durée décroissante, pas par jour). Une séance sans date (cas rare,
  // semaine mise en cache avant "plan figé par jour") reste en fin de liste.
  const ordered = sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => (a.session.date ?? '9999').localeCompare(b.session.date ?? '9999'))

  if (isGenerating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Le coach compose les séances de la semaine...
      </div>
    )
  }

  if (hasNoSessionsYet) {
    return (
      <div className="flex items-center justify-between gap-2 py-2">
        <p className="text-sm text-muted-foreground">Aucune séance type pour cette semaine pour le moment.</p>
        <Button size="sm" variant="outline" onClick={onRegenerate} className="gap-2 shrink-0">
          <Wand2 className="w-3.5 h-3.5" /> Proposer les séances
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="ghost" onClick={onRegenerate} className="gap-1.5 text-xs text-muted-foreground h-7">
          <Wand2 className="w-3 h-3" /> Régénérer
        </Button>
      </div>
      {ordered.map(({ session, index }) => (
        <PlanSessionDetail
          key={index}
          session={session}
          index={index}
          week={week}
          completion={getCompletion(session, index)}
          today={today}
          isSending={sendingSessionKey === `${week.weekNumber}-${index}`}
          canSendToIntervals={canSendToIntervals}
          onSend={onSend}
          onMoveDate={onMoveDate}
          isAdjustingLocation={adjustingLocationKey === `${week.weekNumber}-${index}`}
          onAdjustLocation={(targetLocation) => onAdjustLocation(index, targetLocation)}
        />
      ))}
    </div>
  )
}
