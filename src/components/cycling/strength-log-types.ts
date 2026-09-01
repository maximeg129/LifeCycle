// ── Suivi détaillé des séances de musculation ──────────────────────────
//
// Retour utilisateur : "suivi détaillé par exercice". Distinct de
// sessionFeedback (RPE/ressenti générique, déjà utilisé pour le vélo) : ici,
// les vrais chiffres saisis par l'athlète après une séance — séries,
// répétitions, charge réellement soulevée — pour suivre une progression de
// force dans le temps, exercice par exercice. Jamais un score de force
// inventé (ex. un 1RM calculé) : juste les chiffres réels tels que saisis.

export interface LoggedExercise {
  name: string
  sets: number
  reps: string
  /** Charge en kg — optionnelle (poids du corps, élastique, ou simplement non renseignée). */
  loadKg?: number
  notes?: string
}

export interface StrengthSessionLog {
  userId: string
  date: string // yyyy-MM-dd
  title: string
  exercises: LoggedExercise[]
  /** Lien optionnel vers la semaine du plan dont cette séance est issue — absent pour une séance loguée librement, sans passer par une séance type du plan. */
  planWeekNumber?: number
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
