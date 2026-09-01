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
import { exerciseHistory, formatTimer, isDraftUsable, isHoldReps, parseDurationInput, summarizeSetsDetail, type LoggedExercise, type LoggedSetDetail, type StrengthSessionLog } from './strength-log-types'
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
  /** Index de la séance au sein de la semaine — voir strength-log-types.ts (planSessionIndex), pour rapprocher précisément le log de la séance type prévue (retour utilisateur : "comment lier les seances realisees aux seance prevues"). */
  sessionIndex: number
  /** Identifiant stable de cette séance au sein du plan (ex. "3-1" = semaine 3, séance d'index 1) — même convention que sendingSessionKey dans training-plan-tab.tsx. Sert de clé localStorage pour la sauvegarde de secours ci-dessous. */
  sessionKey: string
  onClose: () => void
}

/**
 * Sauvegarde locale automatique — retour utilisateur : "Ajoute une
 * sauvegarde locale automatique pendant la séance", après une limite
 * signalée honnêtement (fermer l'onglet en cours de séance perdait la
 * progression, jamais sauvegardée avant "Terminer la séance"). Un
 * brouillon par séance (clé localStorage dérivée de sessionKey), écrasé à
 * chaque changement de progression, effacé uniquement à l'enregistrement
 * réussi dans Firestore (jamais à une simple fermeture — l'athlète doit
 * pouvoir reprendre plus tard).
 */
interface StrengthSessionDraft {
  savedAt: number
  /** Horodatage de départ ORIGINAL de la séance — restauré tel quel pour que le chrono reste exact, jamais remis à "maintenant". */
  startedAt: number
  exerciseNames: string[]
  progress: ExerciseProgress[]
}

function draftStorageKey(sessionKey: string): string {
  return `lifecycle:strength-draft:${sessionKey}`
}

/** Lit et valide le brouillon localStorage pour cette séance — jamais bloquant : toute erreur (parsing, quota, API indisponible) renvoie simplement "pas de brouillon" plutôt que de faire planter la vue. Un brouillon trouvé mais invalide (périmé ou séance regénérée entre-temps) est nettoyé au passage plutôt que laissé à traîner indéfiniment. */
function readStrengthDraft(sessionKey: string, currentExerciseNames: string[]): StrengthSessionDraft | null {
  const key = draftStorageKey(sessionKey)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StrengthSessionDraft
    if (isDraftUsable(parsed.savedAt, parsed.exerciseNames, currentExerciseNames, Date.now())) {
      return parsed
    }
    localStorage.removeItem(key)
    return null
  } catch {
    return null
  }
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

export function LiveStrengthSessionView({ session, weekNumber, sessionIndex, sessionKey, onClose }: Props) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const { isSaving, submit } = useCrudSubmit()
  const { logs } = useStrengthLogs()

  const exercises = useMemo(() => session.strengthExercises ?? [], [session.strengthExercises])
  const exerciseNames = useMemo(() => exercises.map((ex) => ex.name), [exercises])

  // Brouillon localStorage éventuel, chargé une seule fois à l'ouverture —
  // calculé une fois via ce ref-sentinelle (idiome de "lazy init" partagé
  // entre plusieurs useState/useRef ci-dessous) plutôt que rechargé à
  // chaque render.
  const draftRef = useRef<StrengthSessionDraft | null | undefined>(undefined)
  if (draftRef.current === undefined) {
    draftRef.current = readStrengthDraft(sessionKey, exerciseNames)
  }
  const draft = draftRef.current

  const [progress, setProgress] = useState<ExerciseProgress[]>(() => {
    if (draft) return draft.progress
    return exercises.map((ex) => {
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
  })

  useEffect(() => {
    if (draft) {
      toast({ title: 'Séance reprise', description: 'Ta progression précédente a été restaurée automatiquement.' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chronomètre de séance — démarre à l'ouverture (ou reprend l'horodatage
  // de départ ORIGINAL si un brouillon est restauré, pour rester exact),
  // tourne en continu. Basé sur un horodatage de départ plutôt qu'un
  // compteur incrémenté, pour ne jamais dériver même si des re-renders
  // sont sautés.
  const startedAtRef = useRef(draft?.startedAt ?? Date.now())

  // Sauvegarde locale automatique — écrasée à chaque changement de
  // progression (y compris une simple modification de reps/charge avant
  // validation d'une série). Jamais bloquant : une erreur (quota plein,
  // localStorage indisponible en navigation privée...) est avalée
  // silencieusement plutôt que de perturber la séance en cours.
  useEffect(() => {
    try {
      const data: StrengthSessionDraft = { savedAt: Date.now(), startedAt: startedAtRef.current, exerciseNames, progress }
      localStorage.setItem(draftStorageKey(sessionKey), JSON.stringify(data))
    } catch {
      // localStorage indisponible/plein — pas bloquant pour la séance.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, sessionKey])

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
      planSessionIndex: sessionIndex,
      // Retour utilisateur : "seras t il possible d'exporter la séance de
      // muscu vers... intervals" — le chrono existait déjà (elapsedSeconds)
      // mais n'était jusqu'ici jamais persisté ; nécessaire pour renseigner
      // moving_time à l'export (voir use-strength-log-export.ts).
      durationSeconds: elapsedSeconds,
      createdAt: serverTimestamp(),
    } satisfies StrengthSessionLog
    const ok = await submit(() => setDoc(ref, data), { path: ref.path, operation: 'create', requestResourceData: data })
    if (ok) {
      // Le brouillon n'a plus lieu d'être une fois la séance vraiment
      // enregistrée — jamais effacé sur une simple fermeture (onClose seul,
      // sans passer par ici), pour que l'athlète puisse reprendre plus tard.
      try {
        localStorage.removeItem(draftStorageKey(sessionKey))
      } catch {
        // pas bloquant — au pire un brouillon orphelin, nettoyé à la prochaine lecture (readStrengthDraft).
      }
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
        {progress.map((ex, exIndex) => {
          // Retour utilisateur, capture d'écran d'une planche à l'appui :
          // "on devrais seulement mettre le temps en minute:seconde" — un
          // exercice de gainage isométrique (planche, Pallof press tenu...)
          // se mesure en secondes tenues, pas en répétitions ; le "reps ×"
          // par défaut était trompeur. isHoldReps() détecte le suffixe "s"
          // déjà utilisé par convention pour ces exercices ("30-45s") — pas
          // de champ dédié dans le schéma IA, voir isHoldReps.
          const isHold = isHoldReps(exercises[exIndex]?.reps ?? '')
          return (
          <div key={exIndex} className="lc-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary shrink-0" />
              <p className="font-medium">{ex.name}</p>
            </div>
            <div className="space-y-2">
              {ex.sets.map((set, setIndex) => (
                <div key={setIndex} className={cn('flex items-center gap-2 p-2 rounded-lg border', set.done ? 'bg-primary/5 border-primary/20' : 'border-border')}>
                  <span className="text-xs text-muted-foreground w-14 shrink-0">Série {setIndex + 1}</span>
                  {isHold ? (
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatTimer(set.reps)}
                      onChange={(e) => updateSet(exIndex, setIndex, { reps: parseDurationInput(e.target.value) })}
                      className="h-9 w-20 text-center"
                      disabled={set.done}
                      aria-label={`Temps tenu, série ${setIndex + 1}`}
                    />
                  ) : (
                    <Input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(exIndex, setIndex, { reps: Number(e.target.value) })}
                      className="h-9 w-16 text-center"
                      disabled={set.done}
                      aria-label={`Répétitions, série ${setIndex + 1}`}
                    />
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">{isHold ? 'tenu ×' : 'reps ×'}</span>
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
          )
        })}

        <Button onClick={handleFinish} disabled={isSaving} size="lg" className="w-full gap-2">
          <Flag className="w-4 h-4" /> Terminer la séance
        </Button>
      </div>
    </div>
  )
}
