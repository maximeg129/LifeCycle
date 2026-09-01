// ── Suivi détaillé des séances de musculation ──────────────────────────
//
// Retour utilisateur : "suivi détaillé par exercice". Distinct de
// sessionFeedback (RPE/ressenti générique, déjà utilisé pour le vélo) : ici,
// les vrais chiffres saisis par l'athlète après une séance — séries,
// répétitions, charge réellement soulevée — pour suivre une progression de
// force dans le temps, exercice par exercice. Jamais un score de force
// inventé (ex. un 1RM calculé) : juste les chiffres réels tels que saisis.

export interface LoggedSetDetail {
  reps: number
  /** Charge en kg — absente pour un exercice au poids du corps/élastique. */
  loadKg?: number
}

export interface LoggedExercise {
  name: string
  sets: number
  reps: string
  /** Charge en kg — optionnelle (poids du corps, élastique, ou simplement non renseignée). */
  loadKg?: number
  notes?: string
  /**
   * Détail série par série — retour utilisateur : "un système de suivi de
   * la séance à la salle, avec chronomètre, temps de repos, détails de
   * l'exercice charge". Présent UNIQUEMENT pour une séance loguée via le
   * suivi en direct (live-strength-session-view.tsx) ; absent pour une
   * séance loguée via le formulaire simple (log-strength-session-dialog.tsx)
   * — sets/reps/loadKg ci-dessus restent alors la seule donnée disponible,
   * dérivée de setsDetail par summarizeSetsDetail() quand il est présent.
   */
  setsDetail?: LoggedSetDetail[]
}

/**
 * Réduit le détail série par série à un résumé (sets/reps/loadKg) — la
 * "série de travail" retenue est celle à la charge la plus lourde
 * (convention courante en musculation : c'est elle qui représente
 * vraiment l'effort de l'exercice), ou la dernière série si aucune charge
 * n'a été saisie (poids du corps). Jamais un score inventé (1RM estimé,
 * volume total...) — juste un résumé fidèle des chiffres réels saisis.
 */
export function summarizeSetsDetail(details: LoggedSetDetail[]): { sets: number; reps: string; loadKg?: number } {
  if (details.length === 0) return { sets: 0, reps: '0' }
  const withLoad = details.filter((d) => d.loadKg != null)
  if (withLoad.length > 0) {
    const top = withLoad.reduce((max, d) => (d.loadKg! > max.loadKg! ? d : max))
    return { sets: details.length, reps: String(top.reps), loadKg: top.loadKg }
  }
  const last = details[details.length - 1]
  return { sets: details.length, reps: String(last.reps) }
}

export interface StrengthSessionLog {
  userId: string
  date: string // yyyy-MM-dd
  title: string
  exercises: LoggedExercise[]
  /** Lien optionnel vers la semaine du plan dont cette séance est issue — absent pour une séance loguée librement, sans passer par une séance type du plan. */
  planWeekNumber?: number
  /**
   * Index de la séance type au sein de cette semaine (week.sampleSessions)
   * — retour utilisateur : "comment lier les seances realisees aux seance
   * prevues". Avec planWeekNumber, identifie précisément QUELLE séance type
   * a été réalisée (une semaine peut avoir plusieurs séances muscu) — plus
   * fiable qu'un simple rapprochement par date, qui casse si l'athlète
   * déplace la date prévue après avoir déjà logué (voir moveSessionDate).
   * Absent pour une séance loguée avant l'introduction de ce champ, ou
   * loguée librement sans passer par une séance type du plan.
   */
  planSessionIndex?: number
  createdAt?: unknown
}

export type StrengthSessionLogWithId = StrengthSessionLog & { id: string }

export interface ExerciseHistoryPoint {
  date: string
  loadKg?: number
  sets: number
  reps: string
}

/**
 * Progression d'un exercice donné à travers les séances loguées — comparaison
 * insensible à la casse/aux espaces (l'athlète peut saisir "Squat" un jour,
 * "squat" un autre). Trié du plus ancien au plus récent, pour un graphe ou
 * une liste de progression simple. Jamais de calcul de 1RM/score dérivé —
 * seulement les chiffres réels tels que saisis.
 */
export function exerciseHistory(logs: StrengthSessionLogWithId[], exerciseName: string): ExerciseHistoryPoint[] {
  const needle = exerciseName.trim().toLowerCase()
  const points: ExerciseHistoryPoint[] = []
  for (const log of logs) {
    for (const ex of log.exercises) {
      if (ex.name.trim().toLowerCase() === needle) {
        points.push({ date: log.date, loadKg: ex.loadKg, sets: ex.sets, reps: ex.reps })
      }
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Distinct exercise names across all logged sessions, most recently logged first — for a picker/quick-filter. */
export function distinctExerciseNames(logs: StrengthSessionLogWithId[]): string[] {
  const seen = new Map<string, string>() // lowercase -> first-seen original casing
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  for (const log of sorted) {
    for (const ex of log.exercises) {
      const key = ex.name.trim().toLowerCase()
      if (key && !seen.has(key)) seen.set(key, ex.name.trim())
    }
  }
  return [...seen.values()]
}

/**
 * Formate un nombre de secondes en "m:ss" (ou "h:mm:ss" au-delà d'une
 * heure) — retour utilisateur : "un système de suivi... avec chronomètre,
 * temps de repos". Négatif traité comme 0 plutôt que d'afficher un signe
 * moins (un décompte de repos ne va jamais sous 0 dans l'UI, mais un
 * setInterval peut ponctuellement dépasser la cible d'une fraction de
 * seconde avant que le clear ne s'applique).
 */
export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Au-delà de cet âge, un brouillon localStorage n'est plus proposé en
 * restauration — retour utilisateur : "sauvegarde locale automatique
 * pendant la séance" (live-strength-session-view.tsx, en cas de fermeture
 * accidentelle de l'onglet avant "Terminer la séance"). Une séance de muscu
 * ne dure jamais plus de quelques heures ; passé 12h c'est très probablement
 * une séance abandonnée d'un jour précédent plutôt qu'une vraie reprise —
 * la restaurer silencieusement serait plus déroutant qu'utile.
 */
export const STRENGTH_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * Un brouillon n'est réutilisable que s'il est assez récent ET qu'il
 * correspond bien à la même liste d'exercices que la séance actuellement
 * ouverte (empreinte par nom, insensible à la casse/aux espaces — même
 * convention que exerciseHistory ci-dessus). Le deuxième cas couvre une
 * séance régénérée ("Régénérer" dans le Plan) entre la sauvegarde du
 * brouillon et la réouverture : restaurer un suivi de séries pour des
 * exercices qui n'existent plus n'aurait aucun sens.
 */
export function isDraftUsable(draftSavedAt: number, draftExerciseNames: string[], currentExerciseNames: string[], nowMs: number): boolean {
  if (nowMs - draftSavedAt > STRENGTH_DRAFT_MAX_AGE_MS) return false
  if (draftExerciseNames.length !== currentExerciseNames.length) return false
  const normalize = (n: string) => n.trim().toLowerCase()
  return draftExerciseNames.every((name, i) => normalize(name) === normalize(currentExerciseNames[i] ?? ''))
}
