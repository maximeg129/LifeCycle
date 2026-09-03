"use client"

import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { MessageCircle } from 'lucide-react'
import { FEELING_EMOJI, FEELING_LABELS, type FeelingLevel, type SessionFeedback, feedbackDocIdForActivity } from './session-feedback-types'

const FEELING_LEVELS: FeelingLevel[] = ['bien', 'neutre', 'mauvais']

/** 2-3 tap RPE + feeling + motivation capture for one Intervals.icu activity — feeds the internal load governor. */
export function QuickFeedbackButton({ activityId, date }: { activityId: string; date: string }) {
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/sessionFeedback/${feedbackDocIdForActivity(activityId)}`)
  }, [db, user, activityId])
  const { data } = useDoc<SessionFeedback>(ref)

  const save = async (patch: Partial<Pick<SessionFeedback, 'rpe' | 'feeling' | 'motivation'>>) => {
    if (!user || !db || !ref) return
    const feedbackData = {
      userId: user.uid,
      activityId,
      date,
      ...patch,
      updatedAt: serverTimestamp(),
      ...(data ? {} : { createdAt: serverTimestamp() }),
    }
    try {
      await setDoc(ref, feedbackData, { merge: true })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: data ? 'update' : 'create', requestResourceData: feedbackData }))
    }
  }

  const hasFeedback = data?.rpe != null || data?.feeling != null || data?.motivation != null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${hasFeedback ? 'text-primary' : 'text-muted-foreground'}`}
          // ⚠️ Bug réel trouvé en direct (retour utilisateur : "le menu ne
          // s'ouvre pas") : preventDefault() ici empêchait le Popover de
          // s'ouvrir. Radix compose le onClick de ce bouton avec son propre
          // handler d'ouverture via composeEventHandlers(props.onClick,
          // context.onOpenToggle) — par défaut { checkForDefaultPrevented:
          // true } — donc dès que ce handler appelle preventDefault(),
          // onOpenToggle n'est plus jamais invoqué : le Popover reste fermé
          // à chaque clic, silencieusement. stopPropagation() seul suffit à
          // empêcher la ligne parente (un <a> vers Intervals.icu dans le
          // Journal) de naviguer au clic — même patron déjà correct dans
          // strength-log-export-button.tsx, jamais besoin de preventDefault
          // pour ça.
          onClick={(e) => e.stopPropagation()}
          title="RPE et sensations"
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-xs text-muted-foreground mb-2">RPE (1 = facile, 10 = proche du TTE)</p>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={data?.rpe === n ? 'default' : 'outline'}
                className="h-7 px-0 text-xs"
                onClick={() => save({ rpe: n })}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Sensations</p>
          <div className="flex gap-2">
            {FEELING_LEVELS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={data?.feeling === f ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => save({ feeling: f })}
                title={FEELING_LABELS[f]}
              >
                {FEELING_EMOJI[f]}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Motivation</p>
          <div className="flex gap-2">
            {FEELING_LEVELS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={data?.motivation === f ? 'default' : 'outline'}
                className="flex-1 text-base"
                onClick={() => save({ motivation: f })}
                title={FEELING_LABELS[f]}
              >
                {FEELING_EMOJI[f]}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
