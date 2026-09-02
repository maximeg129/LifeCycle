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
import { X, Check, SkipForward, Dumbbell, Flag, Pause, Play, RotateCcw, Undo2, Trophy, Minus, Plus, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { cn } from '@/lib/utils'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { useStrengthLogs } from './use-strength-logs'
import { exerciseHistory, formatTimer, isDraftUsable, isHoldReps, parseDurationInput, summarizeSetsDetail, type LoggedExercise, type LoggedSetDetail, type StrengthSessionLog } from './strength-log-types'
import { EXERCISE_TECHNIQUE } from './exercise-technique'
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
  /**
   * État pause/reprise — retour utilisateur : "mettre pause". Le chrono
   * n'est jamais remis à zéro en pause, juste figé : elapsedSeconds
   * soustrait totalPausedMs (temps cumulé passé en pause) de l'écart
   * startedAt→maintenant. pausedAt (l'instant où la pause a commencé) n'a
   * de sens que si isPaused est vrai — restauré tel quel pour qu'une pause
   * en cours au moment de la fermeture accidentelle de l'onglet reste
   * exacte à la réouverture plutôt que de compter silencieusement le temps
   * de pause écoulé hors-app comme du temps actif.
   */
  isPaused: boolean
  pausedAt: number | null
  totalPausedMs: number
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

  /**
   * Progression vierge — extrait en fonction réutilisable pour servir à la
   * fois d'état initial (première ouverture, pas de brouillon) et à
   * "Recommencer" (retour utilisateur : "recommencer le training") plutôt
   * que de dupliquer cette logique de préremplissage à deux endroits.
   */
  const buildFreshProgress = (): ExerciseProgress[] => exercises.map((ex) => {
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

  const [progress, setProgress] = useState<ExerciseProgress[]>(() => (draft ? draft.progress : buildFreshProgress()))

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

  // Pause/reprise — retour utilisateur : "mettre pause et/ou recommencer le
  // training". isPaused est un state (le bouton Pause/Lecture doit
  // re-render) ; pausedAtRef/totalPausedMsRef sont des refs (leur
  // changement seul n'a pas besoin de re-render, le tick à la seconde
  // ci-dessous s'en charge déjà pendant que le chrono tourne).
  const [isPaused, setIsPaused] = useState(draft?.isPaused ?? false)
  const pausedAtRef = useRef<number | null>(draft?.pausedAt ?? null)
  const totalPausedMsRef = useRef(draft?.totalPausedMs ?? 0)

  const togglePause = () => {
    if (isPaused) {
      if (pausedAtRef.current != null) {
        totalPausedMsRef.current += Date.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
      setIsPaused(false)
    } else {
      pausedAtRef.current = Date.now()
      setIsPaused(true)
    }
  }

  // Sauvegarde locale automatique — écrasée à chaque changement de
  // progression (y compris une simple modification de reps/charge avant
  // validation d'une série) ou de l'état pause/reprise. Jamais bloquant :
  // une erreur (quota plein, localStorage indisponible en navigation
  // privée...) est avalée silencieusement plutôt que de perturber la
  // séance en cours.
  useEffect(() => {
    try {
      const data: StrengthSessionDraft = {
        savedAt: Date.now(),
        startedAt: startedAtRef.current,
        isPaused,
        pausedAt: pausedAtRef.current,
        totalPausedMs: totalPausedMsRef.current,
        exerciseNames,
        progress,
      }
      localStorage.setItem(draftStorageKey(sessionKey), JSON.stringify(data))
    } catch {
      // localStorage indisponible/plein — pas bloquant pour la séance.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, isPaused, sessionKey])

  // Écran toujours allumé pendant le suivi — retour utilisateur : "l'écran
  // de l'iPhone ne s'éteint pas parce que c'est vraiment pénible de faire
  // le suivi". Screen Wake Lock API, supportée sur Safari iOS depuis 16.4 —
  // contrairement au Bluetooth (voir la discussion capteur HR plus tôt),
  // ce n'est PAS bloqué par WebKit. Redemandé à la reprise de visibilité
  // (l'OS relâche automatiquement le verrou quand l'onglet passe en
  // arrière-plan — reverrouiller silencieusement au retour). Feature-detect
  // + échec avalé silencieusement (permission refusée, batterie faible,
  // navigateur trop ancien) — jamais bloquant pour la séance elle-même.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Refusé/indisponible — silencieux, pas bloquant pour la séance.
      }
    }
    acquire()
    const handleVisibility = () => {
      if (!cancelled && document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [])

  const [, forceTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])
  // En pause, le chrono reste figé à l'instant où la pause a commencé
  // plutôt que de continuer à avancer — sinon "Terminer la séance" enverrait
  // un moving_time qui compte le temps de pause comme actif (voir
  // durationSeconds à l'export Intervals.icu).
  const elapsedSeconds = isPaused && pausedAtRef.current != null
    ? Math.floor((pausedAtRef.current - startedAtRef.current - totalPausedMsRef.current) / 1000)
    : Math.floor((Date.now() - startedAtRef.current - totalPausedMsRef.current) / 1000)

  // Minuteur de repos — démarre quand une série est marquée faite. Même
  // principe d'horodatage absolu que le chrono ci-dessus (un setInterval
  // seul dérive si l'onglet passe en arrière-plan).
  const [restEndAt, setRestEndAt] = useState<number | null>(null)
  // Quelle série a déclenché le décompte de repos actuel ("exIndex-setIndex")
  // — retour utilisateur : "modifier lorsqu'un exercice a été validé".
  // Dé-valider CETTE série précise annule son décompte ; dé-valider une
  // AUTRE série (plus ancienne, pendant qu'un repos plus récent tourne)
  // laisse le décompte en cours tranquille.
  const restKeyRef = useRef<string | null>(null)
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

  // RPE de séance — retour utilisateur : "je ne sais pas si c'est possible
  // le [Load]" sur l'export Intervals.icu. Load y dépend normalement de la
  // FC (absente pour une séance muscu dans cette app) ; à défaut,
  // session_rpe est le seul signal qu'Intervals.icu peut utiliser — jamais
  // envoyé sans une vraie saisie de l'athlète (voir sessionRpe,
  // strength-log-types.ts). Optionnel : "Terminer la séance" reste
  // possible sans le renseigner, Load reste alors honnêtement "?" côté
  // Intervals.icu plutôt qu'un chiffre inventé.
  const [rpe, setRpe] = useState<number | null>(null)

  // Record personnel — retour utilisateur, en validant la proposition
  // "badge record personnel" : "Oui, pourquoi pas ? Si c'est bien
  // implémenté". Charge historique max par exercice (séances déjà loguées
  // dans Firestore, jamais la séance en cours) — recalculée une seule fois
  // par ouverture, pas à chaque set. Jamais un score inventé (pas de 1RM
  // estimé) : juste "cette charge dépasse-t-elle la meilleure connue ?".
  const exercisePRMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const ex of exercises) {
      const key = ex.name.trim().toLowerCase()
      if (map.has(key)) continue
      const max = exerciseHistory(logs, ex.name).reduce((m, p) => (p.loadKg != null && p.loadKg > m ? p.loadKg : m), 0)
      map.set(key, max)
    }
    return map
  }, [exercises, logs])

  /** Un set donné bat-il le record connu — historique OU déjà fait plus tôt dans CETTE séance ? */
  const isNewPersonalRecord = (exIndex: number, setIndex: number): boolean => {
    const ex = progress[exIndex]
    const set = ex.sets[setIndex]
    if (set.loadKg == null) return false
    const historicalMax = exercisePRMap.get(ex.name.trim().toLowerCase()) ?? 0
    const bestSoFarThisSession = ex.sets.reduce((m, s, i) => (i !== setIndex && s.done && s.loadKg != null && s.loadKg > m ? s.loadKg : m), historicalMax)
    return set.loadKg > bestSoFarThisSession
  }

  const [prSetKeys, setPrSetKeys] = useState<Set<string>>(new Set())

  const updateSet = (exIndex: number, setIndex: number, patch: Partial<SetProgress>) => {
    setProgress((prev) => prev.map((ex, i) => (i !== exIndex ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== setIndex ? s : { ...s, ...patch })) })))
  }

  const markSetDone = (exIndex: number, setIndex: number) => {
    const ex = progress[exIndex]
    const set = ex.sets[setIndex]
    const key = `${exIndex}-${setIndex}`
    if (isNewPersonalRecord(exIndex, setIndex)) {
      setPrSetKeys((prev) => new Set(prev).add(key))
      toast({ title: '🏆 Nouveau record personnel !', description: `${ex.name} — ${set.loadKg}kg` })
    }
    updateSet(exIndex, setIndex, { done: true })
    const isVeryLastSet = exIndex === progress.length - 1 && setIndex === progress[exIndex].sets.length - 1
    if (!isVeryLastSet) {
      restKeyRef.current = key
      setRestEndAt(Date.now() + progress[exIndex].restSeconds * 1000)
    }
  }

  // Chrono grand écran pour un exercice tenu — retour utilisateur : "quand
  // on est en position planche, ce qu'on veut c'est pouvoir regarder le
  // temps facilement... dès qu'on a fini on appuie sur le chronomètre, ça
  // arrête le temps de l'exercice, ça le met dans l'application et ça
  // lance le temps de pause". Un overlay plein écran plutôt qu'un simple
  // agrandissement de l'input — lisible à distance, position plank oblige.
  // Complète la saisie manuelle du temps tenu (toujours possible), ne la
  // remplace pas — utile si le téléphone n'est pas en position lisible.
  const [holdTimer, setHoldTimer] = useState<{ exIndex: number; setIndex: number; startedAt: number } | null>(null)

  /** Même effet que markSetDone (badge PR, décompte de repos), en posant reps ET done en un seul updateSet — évite toute question d'ordre entre deux appels setProgress successifs. */
  const finishHoldSet = (exIndex: number, setIndex: number, elapsedSeconds: number) => {
    const ex = progress[exIndex]
    const set = ex.sets[setIndex]
    const key = `${exIndex}-${setIndex}`
    if (isNewPersonalRecord(exIndex, setIndex)) {
      setPrSetKeys((prev) => new Set(prev).add(key))
      toast({ title: '🏆 Nouveau record personnel !', description: `${ex.name} — ${set.loadKg}kg` })
    }
    updateSet(exIndex, setIndex, { reps: elapsedSeconds, done: true })
    const isVeryLastSet = exIndex === progress.length - 1 && setIndex === progress[exIndex].sets.length - 1
    if (!isVeryLastSet) {
      restKeyRef.current = key
      setRestEndAt(Date.now() + ex.restSeconds * 1000)
    }
  }

  const stopHoldTimer = () => {
    if (!holdTimer) return
    const elapsed = Math.max(1, Math.round((Date.now() - holdTimer.startedAt) / 1000))
    finishHoldSet(holdTimer.exIndex, holdTimer.setIndex, elapsed)
    setHoldTimer(null)
  }

  /**
   * Bascule l'état "faite" d'une série — retour utilisateur : "pouvoir
   * modifier lorsqu'un exercice a été validé". Les champs reps/charge
   * restent de toute façon éditables même une fois "faite" (voir le JSX
   * ci-dessous, plus de `disabled={set.done}`) ; ce bouton sert surtout à
   * annuler une validation faite par erreur (mauvais exercice, mauvaise
   * série) plutôt qu'à corriger un chiffre.
   */
  const toggleSetDone = (exIndex: number, setIndex: number) => {
    const set = progress[exIndex]?.sets[setIndex]
    if (!set) return
    if (set.done) {
      updateSet(exIndex, setIndex, { done: false })
      const key = `${exIndex}-${setIndex}`
      if (restKeyRef.current === key) {
        restKeyRef.current = null
        setRestEndAt(null)
      }
      setPrSetKeys((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    } else {
      markSetDone(exIndex, setIndex)
    }
  }

  // Sauter un exercice — retour utilisateur : "sauter un exercice
  // explicitement, oui". Un exercice déjà "skippable" en pratique (ne
  // rien valider et terminer la séance suffit, voir handleFinish qui
  // filtre les exercices à 0 série faite) — ce bouton rend juste ce choix
  // explicite et visible plutôt qu'une case vide ambiguë ("pas encore
  // fait" vs "volontairement sauté"). Uniquement disponible tant qu'aucune
  // série n'est validée — sauter un exercice déjà entamé n'aurait pas de
  // sens, "Recommencer" (l'exercice entier redevient vierge) est le geste
  // pour ça.
  const [skippedExercises, setSkippedExercises] = useState<Set<number>>(new Set())
  const toggleSkipExercise = (exIndex: number) => {
    setSkippedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(exIndex)) next.delete(exIndex)
      else next.add(exIndex)
      return next
    })
  }

  /**
   * Ajuste le repos en cours de +/-15s — retour utilisateur : "ajuster le
   * repos en direct, oui". Clampé à 0 minimum (jamais négatif) ; ne
   * s'applique qu'au décompte actif, la durée par défaut de la prochaine
   * série reste celle décidée par l'IA (ex.restSeconds), pas modifiée en
   * cascade.
   */
  const adjustRest = (deltaSeconds: number) => {
    setRestEndAt((prev) => {
      if (prev == null) return prev
      const next = prev + deltaSeconds * 1000
      return Math.max(Date.now(), next)
    })
  }

  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)

  /**
   * "Recommencer" — retour utilisateur : "recommencer le training". Remet
   * TOUT à zéro (progression, chrono, pause, repos, RPE) comme une nouvelle
   * ouverture de la même séance ; confirmé via AlertDialog car destructif
   * (la progression en cours est perdue, contrairement à un simple
   * dé-cochage de série).
   */
  const handleRestart = () => {
    setProgress(buildFreshProgress())
    startedAtRef.current = Date.now()
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    setIsPaused(false)
    restKeyRef.current = null
    setRestEndAt(null)
    setRpe(null)
    setPrSetKeys(new Set())
    setSkippedExercises(new Set())
    setRestartConfirmOpen(false)
    toast({ title: 'Séance réinitialisée', description: 'La progression et le chrono sont repartis de zéro.' })
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
      ...(rpe != null ? { sessionRpe: rpe } : {}),
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
      {/* Chrono grand écran d'un exercice tenu — voir startHoldTimer/stopHoldTimer plus haut. z-[60], au-dessus du reste de la vue (z-50). */}
      {holdTimer && (
        <div
          className="fixed inset-0 z-[60] bg-primary text-primary-foreground flex flex-col items-center justify-center gap-6 p-6 cursor-pointer select-none"
          onClick={stopHoldTimer}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') stopHoldTimer() }}
          aria-label="Arrêter le chrono et valider la série"
        >
          <p className="text-sm uppercase tracking-wider font-bold opacity-80 text-center">{progress[holdTimer.exIndex]?.name}</p>
          <p className="lc-data font-bold tabular-nums text-8xl">{formatTimer(Math.floor((Date.now() - holdTimer.startedAt) / 1000))}</p>
          <p className="text-sm opacity-80">Touchez l&apos;écran pour arrêter</p>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Séance en cours</p>
          <p className="font-medium truncate">{session.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={togglePause} aria-label={isPaused ? 'Reprendre le chrono' : 'Mettre en pause'} title={isPaused ? 'Reprendre' : 'Pause'}>
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <div className="text-right px-1">
            <p className={cn('lc-data text-lg font-bold tabular-nums', isPaused && 'text-muted-foreground')}>{formatTimer(elapsedSeconds)}</p>
            <p className="text-[10px] text-muted-foreground">{isPaused ? 'En pause' : `${doneSets}/${totalSets} séries`}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRestartConfirmOpen(true)} aria-label="Recommencer la séance" title="Recommencer">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer sans terminer">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recommencer la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les séries déjà validées et le chrono actuel ({formatTimer(elapsedSeconds)}) seront remis à zéro. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestart}>Recommencer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Progress value={totalSets > 0 ? (doneSets / totalSets) * 100 : 0} className="rounded-none h-1" />

      {restRemainingSeconds != null && (
        <div className="sticky top-[65px] z-10 bg-primary text-primary-foreground p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium shrink-0">Repos</span>
            <span className="lc-data text-2xl font-bold tabular-nums">{formatTimer(restRemainingSeconds)}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Retour utilisateur : "ajuster le repos en direct, oui" — +/-15s sur le décompte en cours, sans toucher au repos par défaut des prochaines séries. */}
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => adjustRest(-15)} aria-label="Réduire le repos de 15 secondes" title="-15s">
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => adjustRest(15)} aria-label="Ajouter 15 secondes de repos" title="+15s">
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRestEndAt(null)} className="gap-1.5">
              <SkipForward className="w-3.5 h-3.5" /> Passer
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {progress.map((ex, exIndex) => {
          // Retour utilisateur, capture d'écran d'une planche à l'appui :
          // "on devrais seulement mettre le temps en minute:seconde" — un
          // exercice de gainage isométrique (planche, Pallof press tenu...)
          // se mesure en secondes tenues, pas en répétitions ; le "reps ×"
          // par défaut était trompeur. isHoldReps() détecte le suffixe "s"
          // déjà utilisé par convention pour ces exercices ("30-45s"), mais
          // reste un signal fragile (texte libre généré par l'IA — retour
          // utilisateur, capture à l'appui : "Planche latérale" affichée en
          // reps au lieu de secondes, le "s" manquait sur cette génération).
          // Les patterns anti-extension/anti-rotation-lateral (gainage) sont
          // TOUJOURS tenus dans cette app (voir S05/CORE_PATTERNS,
          // strengthSessionValidator.ts) — un signal structuré bien plus
          // fiable que la convention textuelle, utilisé en repli.
          const planned = exercises[exIndex]
          const isCorePattern = planned?.pattern === 'anti-extension' || planned?.pattern === 'anti-rotation-lateral'
          const isHold = isHoldReps(planned?.reps ?? '') || isCorePattern
          const isSkipped = skippedExercises.has(exIndex)
          const doneCount = ex.sets.filter((s) => s.done).length
          // "Exercice en cours" — retour utilisateur : look-and-feel façon
          // Hevy, qui met en évidence l'exercice courant plutôt qu'une liste
          // plate. Le premier exercice non sauté avec au moins une série pas
          // encore faite ; jamais recalculé au-delà (pas besoin d'un état
          // dédié, dérivé de progress/skippedExercises à chaque render).
          const isActive = !isSkipped && doneCount < ex.sets.length &&
            progress.slice(0, exIndex).every((prior, i) => skippedExercises.has(i) || prior.sets.every((s) => s.done))
          // "Dernière fois" — retour utilisateur : "context dernière fois
          // visible pendant la séance, oui". La donnée sert déjà à
          // préremplir les champs (buildFreshProgress) ; elle n'était
          // jusqu'ici jamais réaffichée en clair pendant la séance,
          // contrairement à LogStrengthSessionDialog (saisie rétroactive).
          const lastKnown = exerciseHistory(logs, ex.name).at(-1)
          const technique = planned ? EXERCISE_TECHNIQUE[planned.pattern] : undefined
          return (
          <div key={exIndex} className={cn('lc-card p-4 space-y-3 transition-colors', isActive && 'ring-2 ring-primary/50', isSkipped && 'opacity-60')}>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary shrink-0" />
              <p className="font-medium flex-1 min-w-0 truncate">{ex.name}</p>
              <span className="text-xs text-muted-foreground shrink-0 lc-data">{doneCount}/{ex.sets.length}</span>
              {/* Retour utilisateur : "sauter un exercice explicitement, oui" — seulement tant qu'aucune série n'est validée (sauter un exercice déjà entamé n'a pas de sens, voir Recommencer pour repartir de zéro). */}
              {doneCount === 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 shrink-0" onClick={() => toggleSkipExercise(exIndex)}>
                  {isSkipped ? <><Undo2 className="w-3 h-3" /> Reprendre</> : <><ChevronsRight className="w-3 h-3" /> Passer</>}
                </Button>
              )}
            </div>
            {lastKnown && !isSkipped && (
              <p className="text-xs text-muted-foreground -mt-2">
                Dernière fois ({lastKnown.date}) : {lastKnown.sets}×{isHold ? formatTimer(Number(lastKnown.reps)) : lastKnown.reps}{lastKnown.loadKg != null ? ` @ ${lastKnown.loadKg}kg` : ''}
              </p>
            )}
            {isSkipped ? (
              <p className="text-sm text-muted-foreground italic">Exercice sauté pour cette séance.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {/* En-tête de colonnes — retour utilisateur, look-and-feel
                      façon Hevy : plutôt qu'un libellé "reps ×"/"tenu ×"
                      répété sur chaque ligne (une des causes du débordement
                      hors cadre signalé), une seule ligne d'en-tête au-dessus
                      de la liste, alignée sur les mêmes largeurs de colonne. */}
                  <div className="flex items-center gap-1.5 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span className="w-5 shrink-0 text-center">#</span>
                    <span className="w-16 shrink-0 text-center">{isHold ? 'Temps' : 'Reps'}</span>
                    {isHold && <span className="w-9 shrink-0" />}
                    {!isCorePattern && <span className="w-16 shrink-0 text-center">Charge</span>}
                    <span className="ml-auto w-9 shrink-0" />
                  </div>
                  {ex.sets.map((set, setIndex) => {
                    const key = `${exIndex}-${setIndex}`
                    const isPR = prSetKeys.has(key)
                    return (
                    <div key={setIndex} className={cn('flex items-center gap-1.5 p-2 rounded-lg border', isPR ? 'bg-amber-500/10 border-amber-500/40' : set.done ? 'bg-primary/5 border-primary/20' : 'border-border')}>
                      <span className="text-xs text-muted-foreground w-5 shrink-0 text-center font-medium">{setIndex + 1}</span>
                      {isHold ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatTimer(set.reps)}
                          onChange={(e) => updateSet(exIndex, setIndex, { reps: parseDurationInput(e.target.value) })}
                          className="h-9 w-16 text-center shrink-0 px-1"
                          aria-label={`Temps tenu, série ${setIndex + 1}`}
                        />
                      ) : (
                        <Input
                          type="number"
                          value={set.reps}
                          onChange={(e) => updateSet(exIndex, setIndex, { reps: Number(e.target.value) })}
                          className="h-9 w-16 text-center shrink-0 px-1"
                          aria-label={`Répétitions, série ${setIndex + 1}`}
                        />
                      )}
                      {/* Retour utilisateur : "un autre timer... en grand
                          écran... quand on est en position planche, ce
                          qu'on veut c'est pouvoir regarder le temps
                          facilement" — chrono plein écran (voir holdTimer
                          plus haut), en plus de la saisie manuelle
                          ci-dessus (utile si le téléphone n'est pas en
                          position lisible pendant l'exercice). */}
                      {isHold && (set.done ? (
                        <span className="w-9 shrink-0" />
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setHoldTimer({ exIndex, setIndex, startedAt: Date.now() })}
                          aria-label={`Chrono grand écran, série ${setIndex + 1}`}
                          title="Chrono grand écran"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      ))}
                      {/* Retour utilisateur : "je ne sais pas pourquoi tu
                          rajoutes le poids... pour ce type d'exercice" —
                          pas de champ charge pour le gainage
                          (anti-extension/anti-rotation-lateral), toujours
                          au poids du corps dans cette app (loadGuidance
                          "Poids du corps" côté génération IA, voir S05). */}
                      {!isCorePattern && (
                        <Input
                          type="number"
                          step="0.5"
                          value={set.loadKg ?? ''}
                          onChange={(e) => updateSet(exIndex, setIndex, { loadKg: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="kg"
                          className="h-9 w-16 text-center shrink-0 px-1"
                          aria-label={`Charge, série ${setIndex + 1}`}
                        />
                      )}
                      {isPR && <Trophy className="w-4 h-4 text-amber-500 shrink-0" aria-label="Nouveau record personnel" />}
                      {/* Retour utilisateur, capture d'écran à l'appui : les
                          boutons "Fait"/"Valider" débordaient du cadre sur
                          mobile — icône seule (voir aria-label/title pour le
                          texte) plutôt qu'icône + libellé, la ligne entière
                          ne tenait pas sur un iPhone. */}
                      <Button
                        size="icon"
                        variant={set.done ? 'secondary' : 'default'}
                        onClick={() => toggleSetDone(exIndex, setIndex)}
                        className="ml-auto h-9 w-9 shrink-0"
                        aria-label={set.done ? `Annuler la validation, série ${setIndex + 1}` : `Valider la série ${setIndex + 1}`}
                        title={set.done ? 'Modifier — retire la validation' : 'Valider'}
                      >
                        {set.done ? <Undo2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                    )
                  })}
                </div>
                {/* Retour utilisateur : "un lien aussi descriptif, condensé en
                    accordéon... la bonne technique à avoir" — contenu
                    statique par pattern de mouvement, voir exercise-technique.ts. */}
                {technique && (
                  <Accordion type="single" collapsible className="border-t border-border -mx-4 px-4 -mb-1">
                    <AccordionItem value="technique" className="border-b-0">
                      <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
                        Bonne technique — {technique.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <ul className="space-y-1.5 text-sm">
                          {technique.cues.map((cue, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-primary shrink-0">•</span>
                              <span>{cue}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </>
            )}
          </div>
          )
        })}

        <div className="lc-card p-4 space-y-2">
          <p className="text-sm font-medium">RPE de séance (optionnel)</p>
          <p className="text-xs text-muted-foreground">1 = facile, 10 = proche de l&apos;échec — alimente le calcul du Load une fois exportée vers Intervals.icu.</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={rpe === n ? 'default' : 'outline'}
                className="h-8 px-0 text-xs"
                onClick={() => setRpe(rpe === n ? null : n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={handleFinish} disabled={isSaving} size="lg" className="w-full gap-2">
          <Flag className="w-4 h-4" /> Terminer la séance
        </Button>
      </div>
    </div>
  )
}
