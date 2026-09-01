"use client"

// ── Suivi en direct d'une séance de musculation ─────────────────────────
//
// Retour utilisateur : "un système de suivi de la seance a la salle, avec
// chronometre, temps de repos, details de l'exercice charge etc? je pense
// que c serait un vrais plus". Vue plein écran (pas un Dialog standard —
// une séance active a besoin de gros éléments tactiles et d'un chrono
// toujours visible, pas du chrome CrudDialogShell habituel) ouverte depuis
// une carte de séance musculation planifiée (training-plan-tab.tsx).
//
// Complète LogStrengthSessionDialog (saisie rétroactive rapide, sans
// minuteur) plutôt que de le remplacer — deux vrais usages : logger après
// coup une séance faite hors app, ou suivre en direct pendant la séance.
// Les deux écrivent dans la MÊME collection (strengthSessionLogs), jamais
// deux modèles de données différents.

import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { X, Check, SkipForward, Dumbbell, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { cn } from '@/lib/utils'
import { useStrengthLogs } from './use-strength-logs'
import { exerciseHistory, formatTimer, summarizeSetsDetail, type LoggedExercise, type LoggedSetDetail, type StrengthSessionLog } from './strength-log-types'
import type { PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'

/** Repos par défaut si l'exercice n'en porte pas (séance mise en cache avant l'introduction de restSeconds dans le schéma). */
const DEFAULT_REST_SECONDS = 90

interface SetProgress {
  reps: number
  loadKg: number | null
  done: boolean
}

interface ExerciseProgress {
  name: string
  restSeconds: number
  sets: SetProgress[]
}

interface Props {
  session: PlanWeekSession
  weekNumber: number
  onClose: () => void
}

/** Petit bip généré côté client (Web Audio API) — pas de fichier audio à charger, marche hors ligne. Échoue silencieusement si l'API est indisponible/bloquée (jamais bloquant pour la séance). */
function playBeep() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const ctx = new AudioContextCtor()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.4)
  } catch {
    // Web Audio indisponible — silencieux, pas bloquant.
  }
}

export function LiveStrengthSessionView({ session, weekNumber, onClose }: Props) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const { isSaving, submit } = useCrudSubmit()
  const { logs } = useStrengthLogs()

  const exercises = useMemo(() => session.strengthExercises ?? [], [session.strengthExercises])

  const [progress, setProgress] = useState<ExerciseProgress[]>(() =>
    exercises.map((ex) => {
      const lastKnown = exerciseHistory(logs, ex.name).at(-1)
      const fallbackReps = Number(lastKnown?.reps)
      return {
        name: ex.name,
        restSeconds: ex.restSeconds ?? DEFAULT_REST_SECONDS,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: Number.isFinite(fallbackReps) ? fallbackReps : ex.repsMin,
          loadKg: lastKnown?.loadKg ?? null,
          done: false,
        })),
      }
    })
  )

  // Chronomètre de séance — démarre à l'ouverture, tourne en continu. Basé
  // sur un horodatage de départ plutôt qu'un compteur incrémenté, pour ne
  // jamais dériver même si des re-renders sont sautés.
  const startedAtRef = useRef(Date.now())
  const [, forceTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])
  const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000)

  // Minuteur de repos — démarre quand une série est marquée faite. Même
  // principe d'horodatage absolu que le chrono ci-dessus (un setInterval
  // seul dérive si l'onglet passe en arrière-plan).
  const [restEndAt, setRestEndAt] = useState<number | null>(null)
  useEffect(() => {
    if (restEndAt == null) return
    const interval = setInterval(() => forceTick((t) => t + 1), 250)
    return () => clearInterval(interval)
  }, [restEndAt])
  const restRemainingSeconds = restEndAt != null ? Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000)) : null

  useEffect(() => {
    if (restRemainingSeconds !== 0) return
    playBeep()
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200])
    setRestEndAt(null)
  }, [restRemainingSeconds])

  const totalSets = progress.reduce((sum, ex) => sum + ex.sets.length, 0)
  const doneSets = progress.reduce((sum, ex) => sum + ex.sets.filter((s) => s.done).length, 0)

  const updateSet = (exIndex: number, setIndex: number, patch: Partial<SetProgress>) => {
    setProgress((prev) => prev.map((ex, i) => (i !== exIndex ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== setIndex ? s : { ...s, ...patch })) })))
  }

  const markSetDone = (exIndex: number, setIndex: number) => {
    updateSet(exIndex, setIndex, { done: true })
    const isVeryLastSet = exIndex === progress.length - 1 && setIndex === progress[exIndex].sets.length - 1
    if (!isVeryLastSet) setRestEndAt(Date.now() + progress[exIndex].restSeconds * 1000)
  }

  const handleFinish = async () => {
    if (!user || !db) return
    const loggedExercises = progress
      .map((ex): LoggedExercise | null => {
        const setsDetail: LoggedSetDetail[] = ex.sets
          .filter((s) => s.done)
          .map((s) => {
            const detail: LoggedSetDetail = { reps: s.reps }
            if (s.loadKg != null) detail.loadKg = s.loadKg
            return detail
          })
        if (setsDetail.length === 0) return null // exercice sauté entièrement — jamais logué à 0
        return { name: ex.name, ...summarizeSetsDetail(setsDetail), setsDetail }
      })
      .filter((ex): ex is LoggedExercise => ex !== null)

    if (loggedExercises.length === 0) {
      toast({ variant: 'destructive', title: 'Aucune série faite', description: 'Valide au moins une série avant de terminer la séance.' })
      return
    }

    const ref = doc(collection(db, `users/${user.uid}/strengthSessionLogs`))
    const data = {
      userId: user.uid,
      date: format(new Date(), 'yyyy-MM-dd'),
      title: session.title,
      exercises: loggedExercises,
      planWeekNumber: weekNumber,
      createdAt: serverTimestamp(),
    } satisfies StrengthSessionLog
    const ok = await submit(() => setDoc(ref, data), { path: ref.path, operation: 'create', requestResourceData: data })
    if (ok) {
      toast({ title: 'Séance terminée', description: `${session.title} — ${formatTimer(elapsedSeconds)}` })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Séance en cours</p>
          <p className="font-medium truncate">{session.title}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="lc-data text-lg font-bold tabular-nums">{formatTimer(elapsedSeconds)}</p>
            <p className="text-[10px] text-muted-foreground">{doneSets}/{totalSets} séries</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer sans terminer">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Progress value={totalSets > 0 ? (doneSets / totalSets) * 100 : 0} className="rounded-none h-1" />

      {restRemainingSeconds != null && (
        <div className="sticky top-[65px] z-10 bg-primary text-primary-foreground p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Repos</span>
            <span className="lc-data text-2xl font-bold tabular-nums">{formatTimer(restRemainingSeconds)}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRestEndAt(null)} className="gap-1.5">
            <SkipForward className="w-3.5 h-3.5" /> Passer
          </Button>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {progress.map((ex, exIndex) => (
          <div key={exIndex} className="lc-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary shrink-0" />
              <p className="font-medium">{ex.name}</p>
            </div>
            <div className="space-y-2">
              {ex.sets.map((set, setIndex) => (
                <div key={setIndex} className={cn('flex items-center gap-2 p-2 rounded-lg border', set.done ? 'bg-primary/5 border-primary/20' : 'border-border')}>
                  <span className="text-xs text-muted-foreground w-14 shrink-0">Série {setIndex + 1}</span>
                  <Input
                    type="number"
                    value={set.reps}
                    onChange={(e) => updateSet(exIndex, setIndex, { reps: Number(e.target.value) })}
                    className="h-9 w-16 text-center"
                    disabled={set.done}
                    aria-label={`Répétitions, série ${setIndex + 1}`}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">reps ×</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={set.loadKg ?? ''}
                    onChange={(e) => updateSet(exIndex, setIndex, { loadKg: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="kg"
                    className="h-9 w-20 text-center"
                    disabled={set.done}
                    aria-label={`Charge, série ${setIndex + 1}`}
                  />
                  <Button
                    size="sm"
                    variant={set.done ? 'secondary' : 'default'}
                    onClick={() => markSetDone(exIndex, setIndex)}
                    disabled={set.done}
                    className="ml-auto gap-1.5 h-9 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" /> {set.done ? 'Fait' : 'Valider'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button onClick={handleFinish} disabled={isSaving} size="lg" className="w-full gap-2">
          <Flag className="w-4 h-4" /> Terminer la séance
        </Button>
      </div>
    </div>
  )
}
