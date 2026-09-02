"use client"

// ── Bandeau "à traiter" ───────────────────────────────────────────────
//
// Retour utilisateur, en validant une piste de COACH_UX_AUDIT.md (§4.B,
// inspirée de Join — "Home tab card shows activities missing an RPE
// rating") : surfacer PROACTIVEMENT les sorties récentes sans RPE, plutôt
// que de compter sur l'athlète pour remarquer que l'icône
// QuickFeedbackButton d'une sortie n'est pas remplie. Fenêtre de 7 jours,
// même fenêtre que Join.
//
// Scope volontairement limité au vélo : une séance muscu capture déjà son
// RPE de séance AU MOMENT de la logger (LiveStrengthSessionView/
// LogStrengthSessionDialog, voir strength-log-types.ts) — il n'existe pas
// aujourd'hui d'action pour la renseigner après coup depuis le Journal,
// donc l'inclure ici pointerait vers une action qui n'existe pas. Suivi
// possible plus tard si un tel geste rétroactif est ajouté côté muscu.

import { useMemo } from 'react'
import { subDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertCircle } from 'lucide-react'
import { useActivities } from '@/hooks/use-intervals'
import { bestRpe } from '@/lib/intervals-api'
import { useSessionFeedback } from '@/components/cycling/use-session-feedback'
import { QuickFeedbackButton } from '@/components/cycling/quick-feedback-widget'

const WINDOW_DAYS = 7
const MAX_SHOWN = 4

export function PendingFeedbackBanner() {
  const today = new Date()
  const newest = format(today, 'yyyy-MM-dd')
  const oldest = format(subDays(today, WINDOW_DAYS), 'yyyy-MM-dd')
  const activities = useActivities(oldest, newest)
  const { feedback } = useSessionFeedback()

  const localRpeByActivityId = useMemo(() => {
    const map = new Map<string, number | undefined>()
    for (const f of feedback) {
      if (f.activityId) map.set(f.activityId, f.rpe)
    }
    return map
  }, [feedback])

  // "Sans RPE" = ni sur Intervals.icu (icu_rpe/perceived_exertion, saisi
  // directement là-bas) ni en local (sessionFeedback) — même préférence de
  // source que bestRpe(), pour ne jamais redemander un RPE déjà renseigné
  // ailleurs.
  const pending = useMemo(
    () => activities.data.filter((a) => bestRpe(a) == null && localRpeByActivityId.get(a.id) == null),
    [activities.data, localRpeByActivityId]
  )

  if (activities.isLoading || pending.length === 0) return null

  return (
    <div className="lc-card p-4 space-y-3 border-primary/30">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-medium">
          {pending.length} sortie{pending.length > 1 ? 's' : ''} sans RPE cette semaine
        </p>
      </div>
      <div className="space-y-1.5">
        {pending.slice(0, MAX_SHOWN).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate min-w-0 text-muted-foreground">
              {a.name || 'Sortie'}
              {a.start_date_local && ` — ${format(parseISO(a.start_date_local), 'EEE d MMM', { locale: fr })}`}
            </span>
            <QuickFeedbackButton activityId={a.id} date={a.start_date_local?.slice(0, 10) ?? newest} />
          </div>
        ))}
        {pending.length > MAX_SHOWN && (
          <p className="text-xs text-muted-foreground">+{pending.length - MAX_SHOWN} autre{pending.length - MAX_SHOWN > 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  )
}
