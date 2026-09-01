// ── Validation de séance de musculation — grille S05 (fournie par l'utilisateur) ──
//
// Retour utilisateur, verbatim : "Tu dois respecter strictement les règles
// ci-dessous — une séance qui ne les respecte pas ne doit jamais être
// proposée comme séance 'complète'." Cette grille (evidence/
// supplementary-sources.ts, S05) est fournie directement par l'utilisateur,
// pas une publication scientifique — mais l'utilisateur en a demandé une
// application STRICTE, donc les chiffres (matrice charge/reps/repos,
// plafonds de durée/fréquence, délai avant séance clé) sont utilisés tels
// quels ici, sans les édulcorer en simple guidage qualitatif (contrairement
// à d'autres sources pas encore formalisées de ce projet — voir la note ⚠️
// en tête de supplementary-sources.ts).
//
// Même patron que planValidator.ts (9 contrôles de plan-check-*) : chaque
// fonction implémente EXACTEMENT une règle de S05, jamais un seuil inventé
// en plus. `checkTimingBeforeKeySession` reste honnêtement `insufficient_data`
// quand aucune date réelle n'est encore assignée à la séance (le cas pour
// une séance type générée par planWeekSessions, avant que l'athlète ne
// choisisse une date précise) — même discipline que checkIntervalVolume
// dans planValidator.ts pour une donnée non disponible.

import type { PlanCheckResult, PlanOverallVerdict } from './planValidator'

export type MovementPattern =
  | 'bilateral-heavy'
  | 'hip-hinge'
  | 'unilateral'
  | 'anti-extension'
  | 'anti-rotation-lateral'
  | 'ankle-calf'

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  'bilateral-heavy', 'hip-hinge', 'unilateral', 'anti-extension', 'anti-rotation-lateral', 'ankle-calf',
]

const CORE_PATTERNS: MovementPattern[] = ['anti-extension', 'anti-rotation-lateral']

export type StrengthSessionType = 'principale' | 'entretien' | 'top-up'
export type StrengthPhase = 'base' | 'force-max' | 'transfert-puissance' | 'entretien'
export type CyclingPhaseForFrequency = 'base' | 'build' | 'peak' | 'taper' | 'recovery'

export interface StrengthExerciseForValidation {
  pattern: MovementPattern
  sets: number
  repsMin: number
  repsMax: number
  /** null/absent = %1RM non applicable à cet exercice (poids du corps, gainage...). */
  pct1RMMin?: number | null
  pct1RMMax?: number | null
  /** null/absent = non renseigné par le coach IA — le contrôle matrice traite ce champ comme non vérifiable pour cet exercice plutôt que comme une violation. */
  restSeconds?: number | null
}

export interface StrengthSessionInput {
  sessionType: StrengthSessionType
  strengthPhase: StrengthPhase
  durationMinutes: number
  exercises: StrengthExerciseForValidation[]
}

// ── S05 §2 — matrice charge/reps/repos par phase ───────────────────────────
export interface StrengthPhaseBounds {
  setsMin: number
  setsMax: number
  repsMin: number
  repsMax: number
  pct1RMMin: number
  pct1RMMax: number
  restSecondsMin: number
  restSecondsMax: number
}

export const STRENGTH_PHASE_MATRIX: Record<StrengthPhase, StrengthPhaseBounds> = {
  base: { setsMin: 3, setsMax: 3, repsMin: 8, repsMax: 12, pct1RMMin: 60, pct1RMMax: 70, restSecondsMin: 90, restSecondsMax: 120 },
  'force-max': { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6, pct1RMMin: 85, pct1RMMax: 92, restSecondsMin: 180, restSecondsMax: 300 },
  'transfert-puissance': { setsMin: 3, setsMax: 4, repsMin: 4, repsMax: 6, pct1RMMin: 75, pct1RMMax: 85, restSecondsMin: 120, restSecondsMax: 180 },
  entretien: { setsMin: 2, setsMax: 2, repsMin: 5, repsMax: 8, pct1RMMin: 70, pct1RMMax: 80, restSecondsMin: 90, restSecondsMax: 90 },
}

export const REQUIRED_PATTERNS_FOR_PRINCIPAL = 4
export const MAX_PRINCIPAL_SESSION_DURATION_MINUTES = 50 // S05 §3 : "45-50 min max hors échauffement" — borne haute retenue
export const KEY_SESSION_BLACKOUT_HOURS = 48 // S05 §3 : "jamais... dans les 24-48h avant une sortie vélo clé" — borne haute retenue (la plus prudente)
export const HIGH_CYCLING_VOLUME_THRESHOLD_HOURS = 10 // S05 §3 : "si volume vélo hebdo > 10h"

// ── strength-check-1 — couverture des patterns ─────────────────────────────

/**
 * ≥4/6 patterns dont obligatoirement le bilatéral lourd, pour une séance
 * "principale" — exemptée pour "entretien"/"top-up" (S05 §1, exception
 * explicite : 1-2 exercices autorisés).
 */
export function checkPatternCoverage(sessionType: StrengthSessionType, patterns: MovementPattern[]): PlanCheckResult {
  const checkId = 'strength-check-1-pattern-coverage'
  if (sessionType !== 'principale') {
    return { checkId, verdict: 'ok', detail: `Séance "${sessionType}" — exemptée de la couverture minimale de patterns (S05, exception explicite).` }
  }
  const distinct = new Set(patterns)
  if (!distinct.has('bilateral-heavy')) {
    return { checkId, verdict: 'block', detail: 'Bilatéral lourd absent — obligatoire pour une séance "principale" (S05 §1).' }
  }
  if (distinct.size < REQUIRED_PATTERNS_FOR_PRINCIPAL) {
    return { checkId, verdict: 'block', detail: `${distinct.size}/6 patterns couverts — minimum ${REQUIRED_PATTERNS_FOR_PRINCIPAL} requis pour une séance "principale" (S05 §1).` }
  }
  return { checkId, verdict: 'ok', detail: `${distinct.size}/6 patterns couverts, dont le bilatéral lourd.` }
}

// ── strength-check-2 — récence du hip-hinge ────────────────────────────────

/** Hip-hinge requis dès qu'il est absent des 2 dernières séances enregistrées (S05 §1). */
export function checkHipHingePresence(currentPatterns: MovementPattern[], previousSessionsPatterns: MovementPattern[][]): PlanCheckResult {
  const checkId = 'strength-check-2-hip-hinge-recency'
  if (currentPatterns.includes('hip-hinge')) {
    return { checkId, verdict: 'ok', detail: 'Hip-hinge présent dans cette séance.' }
  }
  const lastTwo = previousSessionsPatterns.slice(-2)
  if (lastTwo.some((p) => p.includes('hip-hinge'))) {
    return { checkId, verdict: 'ok', detail: 'Hip-hinge absent ici mais présent dans une des 2 dernières séances — pas requis cette fois (S05).' }
  }
  return { checkId, verdict: 'warn', detail: 'Hip-hinge absent de cette séance ET des 2 dernières séances enregistrées (S05).' }
}

// ── strength-check-3 — plans de gainage ─────────────────────────────────────

/** Gainage sur au moins 2 plans (anti-extension ET anti-rotation/latéral) — pas uniquement anti-extension (S05 §1). */
export function checkCorePlanes(patterns: MovementPattern[]): PlanCheckResult {
  const checkId = 'strength-check-3-core-planes'
  const coreCoverage = CORE_PATTERNS.filter((p) => patterns.includes(p))
  if (coreCoverage.length === 0) {
    return { checkId, verdict: 'insufficient_data', detail: 'Aucun travail de gainage dans cette séance — S05 ne couvre que la répartition entre plans, pas son absence totale.' }
  }
  if (coreCoverage.length === 1) {
    return { checkId, verdict: 'warn', detail: `Gainage limité à un seul plan (${coreCoverage[0]}) — S05 recommande les 2 plans (anti-extension et anti-rotation/latéral).` }
  }
  return { checkId, verdict: 'ok', detail: 'Gainage couvre les 2 plans (anti-extension et anti-rotation/latéral).' }
}

// ── strength-check-4 — matrice charge/reps/repos ────────────────────────────

/**
 * Patterns exemptés de la matrice numérique — trouvaille de la vérification
 * "à blanc" du pipeline (fixture réaliste incluant une planche/un Pallof
 * press) : S05 §2 donne une matrice pensée pour les lifts principaux
 * (squat, hip-hinge, unilatéral), exprimée en répétitions et %1RM — un
 * gainage isométrique (secondes tenues, pas de charge externe comparable à
 * un %1RM) ou un travail cheville/mollet léger ne s'y prête pas
 * physiologiquement. [Convention] — S05 ne le dit pas explicitement, mais
 * appliquer littéralement "3-6 répétitions à 85-92% 1RM" à une planche
 * n'a pas de sens et signalerait à tort une séance par ailleurs conforme.
 */
const MATRIX_EXEMPT_PATTERNS: MovementPattern[] = ['anti-extension', 'anti-rotation-lateral', 'ankle-calf']

/** Chaque exercice des patterns "lift principal" (bilatéral lourd/hip-hinge/unilatéral) cohérent avec la matrice de sa phase déclarée (S05 §2) — tolérant au chevauchement de plage plutôt qu'une correspondance exacte. Gainage/cheville exemptés, voir MATRIX_EXEMPT_PATTERNS. */
export function checkLoadRepsRestConsistency(strengthPhase: StrengthPhase, exercises: StrengthExerciseForValidation[]): PlanCheckResult {
  const checkId = 'strength-check-4-load-reps-rest-matrix'
  const applicable = exercises.filter((ex) => !MATRIX_EXEMPT_PATTERNS.includes(ex.pattern))
  if (applicable.length === 0) {
    return {
      checkId,
      verdict: 'insufficient_data',
      detail: exercises.length === 0 ? 'Aucun exercice à évaluer.' : 'Aucun exercice concerné par la matrice (uniquement du gainage/cheville, exemptés — voir MATRIX_EXEMPT_PATTERNS).',
    }
  }

  const bounds = STRENGTH_PHASE_MATRIX[strengthPhase]
  const violations: string[] = []
  for (const ex of applicable) {
    if (ex.sets < bounds.setsMin || ex.sets > bounds.setsMax) {
      violations.push(`${ex.pattern} : ${ex.sets} séries hors ${bounds.setsMin}-${bounds.setsMax}`)
    }
    if (ex.repsMax < bounds.repsMin || ex.repsMin > bounds.repsMax) {
      violations.push(`${ex.pattern} : ${ex.repsMin}-${ex.repsMax} répétitions hors ${bounds.repsMin}-${bounds.repsMax}`)
    }
    if (ex.pct1RMMin != null && ex.pct1RMMax != null && (ex.pct1RMMax < bounds.pct1RMMin || ex.pct1RMMin > bounds.pct1RMMax)) {
      violations.push(`${ex.pattern} : ${ex.pct1RMMin}-${ex.pct1RMMax}% 1RM hors ${bounds.pct1RMMin}-${bounds.pct1RMMax}%`)
    }
    if (ex.restSeconds != null && (ex.restSeconds < bounds.restSecondsMin || ex.restSeconds > bounds.restSecondsMax)) {
      violations.push(`${ex.pattern} : repos ${ex.restSeconds}s hors ${bounds.restSecondsMin}-${bounds.restSecondsMax}s`)
    }
  }
  if (violations.length > 0) {
    return { checkId, verdict: 'warn', detail: `Écart(s) avec la matrice S05 (phase "${strengthPhase}") : ${violations.join(' ; ')}.` }
  }
  return { checkId, verdict: 'ok', detail: `Charge/reps/repos cohérents avec la phase "${strengthPhase}" (S05 §2).` }
}

// ── strength-check-5 — durée ─────────────────────────────────────────────────

/** ≤45-50min hors échauffement pour une séance "principale" (S05 §3) — pas de plafond imposé aux séances entretien/top-up. */
export function checkSessionDuration(sessionType: StrengthSessionType, durationMinutes: number): PlanCheckResult {
  const checkId = 'strength-check-5-duration'
  if (sessionType !== 'principale') {
    return { checkId, verdict: 'ok', detail: `Séance "${sessionType}" — pas de plafond de durée spécifique (S05 ne l'impose qu'aux séances principales).` }
  }
  if (durationMinutes > MAX_PRINCIPAL_SESSION_DURATION_MINUTES) {
    return { checkId, verdict: 'warn', detail: `${durationMinutes}min dépasse le plafond de ${MAX_PRINCIPAL_SESSION_DURATION_MINUTES}min hors échauffement pour une séance principale (S05 §3).` }
  }
  return { checkId, verdict: 'ok', detail: `${durationMinutes}min, sous le plafond de ${MAX_PRINCIPAL_SESSION_DURATION_MINUTES}min.` }
}

// ── strength-check-6 — fréquence hebdomadaire vs volume vélo ────────────────

/**
 * Si volume vélo hebdo > 10h : ≤2 séances force/semaine en phase build,
 * ≤1/semaine en pleine saison (S05 §3). "Pleine saison" est mappée sur la
 * phase "peak" du modèle de périodisation de cette app — [convention],
 * S05 utilise un vocabulaire différent de PlanPhase sans correspondance
 * officielle donnée.
 */
export function checkWeeklyStrengthFrequency(weeklyCyclingHours: number, cyclingPhase: CyclingPhaseForFrequency, strengthSessionsThisWeek: number): PlanCheckResult {
  const checkId = 'strength-check-6-weekly-frequency'
  if (weeklyCyclingHours <= HIGH_CYCLING_VOLUME_THRESHOLD_HOURS) {
    return { checkId, verdict: 'ok', detail: `Volume vélo hebdo (${weeklyCyclingHours}h) ≤${HIGH_CYCLING_VOLUME_THRESHOLD_HOURS}h — S05 n'impose pas de plafond de fréquence dans ce cas.` }
  }
  const maxSessions = cyclingPhase === 'peak' ? 1 : cyclingPhase === 'build' ? 2 : null
  if (maxSessions == null) {
    return { checkId, verdict: 'insufficient_data', detail: `S05 ne précise un plafond que pour les phases build ("2 max") et peak/"pleine saison" ("1 max") — phase "${cyclingPhase}" non couverte.` }
  }
  if (strengthSessionsThisWeek > maxSessions) {
    return { checkId, verdict: 'warn', detail: `${strengthSessionsThisWeek} séances de musculation cette semaine, au-dessus du plafond de ${maxSessions} (volume vélo >${HIGH_CYCLING_VOLUME_THRESHOLD_HOURS}h, phase "${cyclingPhase}", S05 §3).` }
  }
  return { checkId, verdict: 'ok', detail: `${strengthSessionsThisWeek} séance(s) de musculation, dans le plafond de ${maxSessions} (S05 §3).` }
}

// ── strength-check-7 — délai avant une séance vélo clé ──────────────────────

/**
 * Jamais de séance force lourde (force max ou transfert-puissance) dans
 * les 24-48h avant une sortie vélo clé (S05 §3) — reste honnêtement
 * `insufficient_data` tant qu'aucune date réelle n'est assignée (le cas
 * d'une séance type de planWeekSessions, avant que l'athlète choisisse une
 * date précise pour l'envoyer sur Intervals.icu).
 */
export function checkTimingBeforeKeySession(strengthPhase: StrengthPhase, hoursBeforeNextKeySession: number | null): PlanCheckResult {
  const checkId = 'strength-check-7-timing-before-key-session'
  const isHeavy = strengthPhase === 'force-max' || strengthPhase === 'transfert-puissance'
  if (!isHeavy) {
    return { checkId, verdict: 'ok', detail: `Phase "${strengthPhase}" — S05 ne restreint le délai que pour force max/transfert-puissance.` }
  }
  if (hoursBeforeNextKeySession == null) {
    return { checkId, verdict: 'insufficient_data', detail: 'Aucune date réelle assignée à cette séance — impossible de vérifier le délai avant une séance vélo clé (S05 §3).' }
  }
  if (hoursBeforeNextKeySession < KEY_SESSION_BLACKOUT_HOURS) {
    return { checkId, verdict: 'block', detail: `Séance "${strengthPhase}" placée ${hoursBeforeNextKeySession}h avant la prochaine séance vélo clé — sous le seuil de ${KEY_SESSION_BLACKOUT_HOURS}h imposé par S05 §3.` }
  }
  return { checkId, verdict: 'ok', detail: `${hoursBeforeNextKeySession}h avant la prochaine séance vélo clé — au-delà du seuil de ${KEY_SESSION_BLACKOUT_HOURS}h.` }
}

// ── Orchestrateur ────────────────────────────────────────────────────────────

export interface StrengthSessionValidationInput {
  session: StrengthSessionInput
  /** Patterns des séances précédentes, de la plus ancienne à la plus récente — voir checkHipHingePresence. */
  previousSessionsPatterns: MovementPattern[][]
  weeklyCyclingHours: number
  cyclingPhase: CyclingPhaseForFrequency
  /** Nombre total de séances de musculation cette semaine, CETTE séance incluse. */
  strengthSessionsThisWeek: number
  /** null si aucune date réelle n'est encore assignée (voir checkTimingBeforeKeySession). */
  hoursBeforeNextKeySession: number | null
}

export interface StrengthSessionValidationSummary {
  results: PlanCheckResult[]
  overallVerdict: PlanOverallVerdict
  /**
   * true dès que sessionType n'est PAS "principale" — S05 §4, dernière case
   * de la checklist : "si is_maintenance_only: true, l'interface doit
   * l'afficher clairement comme telle, pas comme séance de force par
   * défaut". Champ dédié plutôt que de relire sessionType ailleurs, pour
   * que l'UI n'ait qu'un seul booléen à vérifier.
   */
  isMaintenanceOnly: boolean
}

/** ≥2 WARN (ou tout BLOCK) → "à revoir"/"bloqué" — même principe que validatePlan, seuil ajusté au nombre de contrôles (7, contre 9 pour le plan). */
const WARN_THRESHOLD_FOR_REVIEW = 2

export function validateStrengthSession(input: StrengthSessionValidationInput): StrengthSessionValidationSummary {
  const patterns = input.session.exercises.map((e) => e.pattern)
  const results: PlanCheckResult[] = [
    checkPatternCoverage(input.session.sessionType, patterns),
    checkHipHingePresence(patterns, input.previousSessionsPatterns),
    checkCorePlanes(patterns),
    checkLoadRepsRestConsistency(input.session.strengthPhase, input.session.exercises),
    checkSessionDuration(input.session.sessionType, input.session.durationMinutes),
    checkWeeklyStrengthFrequency(input.weeklyCyclingHours, input.cyclingPhase, input.strengthSessionsThisWeek),
    checkTimingBeforeKeySession(input.session.strengthPhase, input.hoursBeforeNextKeySession),
  ]
  const hasBlock = results.some((r) => r.verdict === 'block')
  const warnCount = results.filter((r) => r.verdict === 'warn').length
  const overallVerdict: PlanOverallVerdict = hasBlock ? 'blocked' : warnCount >= WARN_THRESHOLD_FOR_REVIEW ? 'to-review' : 'ok'

  return { results, overallVerdict, isMaintenanceOnly: input.session.sessionType !== 'principale' }
}
