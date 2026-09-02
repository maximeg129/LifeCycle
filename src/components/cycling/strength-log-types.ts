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
  /**
   * Durée réelle de la séance en secondes — retour utilisateur : "seras
   * t il possible d'exporter la séance de muscu vers... intervals". Le
   * chrono de LiveStrengthSessionView existait déjà mais n'était jusqu'ici
   * jamais persisté ; nécessaire pour renseigner `moving_time` à l'export
   * (voir exportStrengthLogToIntervals, use-strength-log-export.ts). Absent
   * pour une séance loguée via le formulaire rétroactif
   * (log-strength-session-dialog.tsx), qui ne suit pas le temps.
   */
  durationSeconds?: number
  /**
   * Id de l'activité Intervals.icu créée pour cette séance, une fois
   * exportée — l'API manuelle d'Intervals.icu n'a pas d'upsert-par-id
   * (contrairement à /events pour les séances planifiées) : renvoyer
   * exporterait un DOUBLON plutôt que de mettre à jour l'activité
   * existante. Ce champ sert de garde côté UI (bouton désactivé une fois
   * présent) plutôt que de compter sur l'athlète pour ne cliquer qu'une
   * fois.
   */
  intervalsActivityId?: string
  /**
   * RPE de séance (1-10, "distance par rapport au TTE") — retour
   * utilisateur : "je ne sais pas si c'est possible le [Load]". Load sur
   * Intervals.icu est calculé PAR EUX à partir de la FC (aucune FC captée
   * pour une séance muscu dans cette app) ou, à défaut, du couple RPE ×
   * durée (session_rpe, voir exportStrengthLogToIntervals) — jamais un
   * chiffre inventé côté app : ce champ n'existe que si l'athlète l'a
   * réellement saisi (LiveStrengthSessionView en fin de séance,
   * LogStrengthSessionDialog en saisie rétroactive), et reste absent
   * sinon — Load affiche alors honnêtement "?" sur Intervals.icu plutôt
   * qu'un chiffre halluciné.
   */
  sessionRpe?: number
  /**
   * Note de séance libre — retour utilisateur : "note par exercice pendant
   * la séance pas nécessaire, nous pouvons faire une note après la séance
   * avant d'envoyer sur intervalles". Une seule note globale, saisie au
   * moment de l'export plutôt qu'une note par exercice pendant le suivi en
   * direct (voir StrengthLogExportButton) — ajoutée à la description
   * envoyée à Intervals.icu ET conservée ici pour rester visible même sans
   * export.
   */
  sessionNotes?: string
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
 * Détecte si un exercice est mesuré en temps tenu plutôt qu'en répétitions
 * — retour utilisateur, capture d'écran d'une planche à l'appui : "on
 * devrais seulement mettre le temps en minute:seconde". Aucun champ dédié
 * dans le schéma IA (`reps` reste une chaîne "human-readable" libre, voir
 * plan-week-sessions-flow.ts) — le suffixe "s" ("30-45s", déjà la
 * convention utilisée pour un gainage isométrique dans les fixtures de
 * vérification, voir plan-week-sessions-output.test.ts) est le seul signal
 * disponible sans changer le schéma IA. Insensible à la casse/aux espaces ;
 * un exercice classique ("8-10", "5") ne matche jamais.
 */
export function isHoldReps(reps: string): boolean {
  return /\d\s*s\s*$/i.test(reps.trim())
}

/**
 * Lit une saisie "m:ss" (ou "h:mm:ss", ou juste des secondes en clair) et
 * renvoie un total de secondes — l'inverse de formatTimer, pour éditer un
 * temps tenu (voir isHoldReps) dans live-strength-session-view.tsx. Une
 * saisie invalide ou vide renvoie 0 plutôt que de planter — l'athlète a pu
 * juste effacer le champ pour retaper.
 */
export function parseDurationInput(text: string): number {
  const parts = text.trim().split(':').map((p) => Number(p))
  if (parts.length === 0 || parts.some((p) => !Number.isFinite(p))) return 0
  const [a = 0, b, c] = parts
  if (c !== undefined) return Math.max(0, Math.round(a * 3600 + b * 60 + c))
  if (b !== undefined) return Math.max(0, Math.round(a * 60 + b))
  return Math.max(0, Math.round(a))
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

// ── Export vers Intervals.icu ────────────────────────────────────────────
//
// Retour utilisateur : "seras t il possible d'exporter la séance de muscu
// vers Strava et/ou dans intervals". Intervals.icu N'A PAS de modèle
// structuré séries/répétitions pour une activité "WeightTraining" créée
// via l'API — confirmé par les retours de la communauté sur leur forum
// (contrairement à un fichier FIT natif de montre/app dédiée), donc le
// détail série par série est mis en texte libre dans `description`, seul
// champ où Intervals.icu peut l'afficher. Jamais un score inventé — les
// chiffres réels tels que loggués, une ligne par exercice.

/**
 * Une ligne par exercice, avec le détail série par série quand disponible
 * (suivi en direct) ou le résumé sets/reps/loadKg sinon (saisie
 * rétroactive) — voir summarizeSetsDetail ci-dessus pour la même
 * dégradation utilisée ailleurs dans ce fichier.
 */
export function formatStrengthLogDescription(exercises: LoggedExercise[]): string {
  return exercises
    .map((ex) => {
      const detail = ex.setsDetail && ex.setsDetail.length > 0
        ? ex.setsDetail.map((d) => `${d.reps} reps${d.loadKg != null ? ` @ ${d.loadKg}kg` : ''}`).join(', ')
        : `${ex.sets}x${ex.reps}${ex.loadKg != null ? ` @ ${ex.loadKg}kg` : ''}`
      const notes = ex.notes ? ` (${ex.notes})` : ''
      return `${ex.name}: ${detail}${notes}`
    })
    .join('\n')
}

/**
 * Nombre de répétitions représentatif à partir d'une chaîne "reps" libre
 * ("5", "8-10") — moyenne des nombres trouvés dans la chaîne (une plage
 * "8-10" devient 9). Jamais un chiffre halluciné : c'est la seule lecture
 * cohérente d'une plage prescrite quand aucun détail série par série n'est
 * disponible (voir totalWeightLiftedKg ci-dessous). Renvoie 0 pour une
 * chaîne sans aucun nombre plutôt que de planter.
 */
function averageRepsCount(reps: string): number {
  const numbers = reps.match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  if (numbers.length === 0) return 0
  return numbers.reduce((a, b) => a + b, 0) / numbers.length
}

/**
 * Poids total soulevé (kg) — retour utilisateur : "ça ne revoit pas
 * beaucoup d'informations... alors qu'on a la charge". C'est le "Weight
 * Lifted" affiché par Intervals.icu une fois l'activité exportée (champ
 * `kg_lifted`, confirmé via le schéma OpenAPI public d'Intervals.icu — voir
 * ManualActivityInput, intervals-api.ts). Somme reps × charge sur chaque
 * série qui porte une charge ; une série au poids du corps (loadKg absent)
 * est ignorée plutôt que de lui attribuer un poids corporel estimé —
 * jamais un chiffre inventé, uniquement les charges réellement saisies.
 * Utilise setsDetail (suivi en direct) quand disponible pour un total
 * exact série par série ; dégrade sur sets × loadKg × répétitions moyennes
 * de la chaîne reps sinon (saisie rétroactive, voir averageRepsCount) —
 * moins précis mais c'est la seule donnée disponible dans ce cas.
 */
export function totalWeightLiftedKg(exercises: LoggedExercise[]): number {
  const total = exercises.reduce((sum, ex) => {
    if (ex.setsDetail && ex.setsDetail.length > 0) {
      return sum + ex.setsDetail.reduce((s, d) => s + (d.loadKg != null ? d.reps * d.loadKg : 0), 0)
    }
    if (ex.loadKg != null) {
      return sum + ex.sets * averageRepsCount(ex.reps) * ex.loadKg
    }
    return sum
  }, 0)
  return Math.round(total * 10) / 10
}
