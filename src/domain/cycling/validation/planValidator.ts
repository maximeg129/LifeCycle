// ── Validation de plan — les 9 contrôles de la section 4 ───────────────────
//
// Chaque fonction ci-dessous implémente EXACTEMENT une des 9 règles
// `plan-check-*` de evidence/rules.ts (section 4 de la spécification) — ce
// fichier n'invente aucun nouveau seuil, il applique la logique de
// comparaison déjà écrite dans le texte de chaque règle sourcée. Il ne
// RECALCULE PAS non plus les métriques physiologiques elles-mêmes
// (kJ/kg, monotonie, distribution de zones...) — celles-ci viennent des
// modules déjà livrés (metrics/kj.ts, metrics/load.ts, metrics/zones.ts) ;
// ce module se contente d'appliquer les seuils de décision aux valeurs
// déjà calculées, qu'on lui passe en entrée.
//
// ⚠️ Deux des 9 contrôles n'ont PAS de seuil numérique exploitable dans les
// 35 références — documentés honnêtement plutôt que comblés par une valeur
// inventée (voir Q7, docs/OPEN_QUESTIONS.md) :
// - **plan-check-4 (monotonie)** : R21 introduit la monotonie mais ne
//   fixe aucun seuil "élevé" — `checkMonotony` accepte donc un
//   `monotonyThreshold` obligatoire (aucune valeur par défaut) que
//   l'appelant doit fournir consciemment.
// - **plan-check-5 (volume d'intervalles)** : R19 est un constat
//   qualitatif (12 entraîneurs norvégiens interrogés), sans base de
//   données de "modèles d'entraîneurs de haut niveau" comparable dans
//   cette app — `checkIntervalVolume` renvoie toujours `insufficient_data`.
//   Cette règle reste une appréciation qualitative laissée au modèle
//   (déjà grounded via buildSystemPrompt, scope plan-validation), pas un
//   calcul déterministe ici.

import { KJ_DURABILITY_THRESHOLDS, requireConstant } from '../evidence/constants'
import { RULES } from '../evidence/rules'

export type CheckVerdict = 'ok' | 'warn' | 'block' | 'insufficient_data'

export interface PlanCheckResult {
  /** Id de la CoachRule (evidence/rules.ts) que ce résultat traduit — jamais un id inventé (voir checkTraceability). */
  checkId: string
  verdict: CheckVerdict
  detail: string
}

// ── plan-check-1 — distribution d'intensité (R18) ──────────────────────────

/**
 * ~80% des séances en basse intensité ; écart > 15 points → WARN. Les deux
 * chiffres (80, 15) viennent du texte de la règle plan-check-1-intensity-
 * distribution, déjà sourcé R18. `weeklyLowIntensityPct` : voir
 * metrics/zones.ts, `lowIntensityPct()`, agrégé sur la semaine.
 */
export function checkIntensityDistribution(weeklyLowIntensityPct: number | null): PlanCheckResult {
  const checkId = 'plan-check-1-intensity-distribution'
  if (weeklyLowIntensityPct == null) {
    return { checkId, verdict: 'insufficient_data', detail: 'Distribution de zones non disponible pour cette semaine.' }
  }
  const target = 80
  const deviation = Math.abs(weeklyLowIntensityPct - target)
  if (deviation > 15) {
    return {
      checkId,
      verdict: 'warn',
      detail: `${weeklyLowIntensityPct.toFixed(0)}% de basse intensité, écart de ${deviation.toFixed(0)} points par rapport à la cible ~80%.`,
    }
  }
  return { checkId, verdict: 'ok', detail: `${weeklyLowIntensityPct.toFixed(0)}% de basse intensité, dans la plage attendue.` }
}

// ── plan-check-2 — budget kJ/kg pondéré (R09/R10) ──────────────────────────

/**
 * Dépasse le plafond hebdomadaire calibré → WARN ; dépasse de >20% → BLOCK.
 * `calibratedCeilingKJPerKg` : la baseline personnelle de l'athlète (voir
 * metrics/kj.ts, `baselineKJPerKg()`/`computeTargetKJPerKg()`) — ce module
 * ne la recalcule pas, il compare ce qu'on lui donne.
 */
export function checkKJBudget(plannedWeeklyKJPerKg: number | null, calibratedCeilingKJPerKg: number | null): PlanCheckResult {
  const checkId = 'plan-check-2-kj-budget-weighted'
  if (plannedWeeklyKJPerKg == null || calibratedCeilingKJPerKg == null || calibratedCeilingKJPerKg <= 0) {
    return { checkId, verdict: 'insufficient_data', detail: 'Budget kJ/kg planifié ou plafond calibré indisponible.' }
  }
  const overshootPct = ((plannedWeeklyKJPerKg - calibratedCeilingKJPerKg) / calibratedCeilingKJPerKg) * 100
  if (overshootPct > 20) {
    return { checkId, verdict: 'block', detail: `${plannedWeeklyKJPerKg.toFixed(1)} kJ/kg dépasse le plafond de ${overshootPct.toFixed(0)}% (>20%).` }
  }
  if (plannedWeeklyKJPerKg > calibratedCeilingKJPerKg) {
    return { checkId, verdict: 'warn', detail: `${plannedWeeklyKJPerKg.toFixed(1)} kJ/kg dépasse le plafond calibré (${calibratedCeilingKJPerKg.toFixed(1)} kJ/kg).` }
  }
  return { checkId, verdict: 'ok', detail: `${plannedWeeklyKJPerKg.toFixed(1)} kJ/kg reste sous le plafond calibré.` }
}

// ── plan-check-3 — charge accumulée avant une séance clé (R08/R11) ────────

export interface DayLoad {
  date: string
  kJPerKg: number
  isKeySession: boolean
}

/**
 * Séance de qualité après >20 kJ/kg le jour-même ou la veille → WARN. Le
 * seuil (20 kJ/kg) n'est pas réinventé ici — c'est le même seuil déjà
 * sourcé R11 dans KJ_DURABILITY_THRESHOLDS.womenDivergenceStartKJPerKg
 * (evidence/constants.ts), réutilisé tel quel plutôt que dupliqué en dur.
 */
export function checkAccumulatedLoadBeforeKeySession(days: DayLoad[]): PlanCheckResult {
  const checkId = 'plan-check-3-accumulated-load-before-key-session'
  if (days.length === 0) return { checkId, verdict: 'insufficient_data', detail: 'Aucune journée fournie.' }

  const threshold = requireConstant(KJ_DURABILITY_THRESHOLDS, 'KJ_DURABILITY_THRESHOLDS').womenDivergenceStartKJPerKg
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const flaggedDates: string[] = []

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i]
    if (!day.isKeySession) continue
    const previousDayKJPerKg = i > 0 ? sorted[i - 1].kJPerKg : 0
    if (day.kJPerKg > threshold || previousDayKJPerKg > threshold) flaggedDates.push(day.date)
  }

  if (flaggedDates.length > 0) {
    return { checkId, verdict: 'warn', detail: `Séance(s) clé précédée(s) de >${threshold} kJ/kg le jour-même ou la veille : ${flaggedDates.join(', ')}.` }
  }
  return { checkId, verdict: 'ok', detail: 'Aucune séance clé précédée de charge excessive.' }
}

// ── plan-check-4 — monotonie (R21) ─────────────────────────────────────────

/**
 * Monotonie élevée sur 7 jours glissants → WARN. R21 introduit la
 * monotonie (Foster) mais ne fixe AUCUN seuil "élevé" chiffré — voir Q7
 * (docs/OPEN_QUESTIONS.md). `monotonyThreshold` est donc un paramètre
 * OBLIGATOIRE (pas de valeur par défaut) : l'appelant doit le fournir
 * consciemment tant qu'aucune source ou convention ne le fixe.
 */
export function checkMonotony(monotony: number | null, monotonyThreshold: number): PlanCheckResult {
  const checkId = 'plan-check-4-monotony'
  if (monotony == null) return { checkId, verdict: 'insufficient_data', detail: 'Monotonie non calculable (voir metrics/load.ts).' }
  if (monotony > monotonyThreshold) {
    return { checkId, verdict: 'warn', detail: `Monotonie ${monotony.toFixed(2)} au-dessus du seuil fourni (${monotonyThreshold}).` }
  }
  return { checkId, verdict: 'ok', detail: `Monotonie ${monotony.toFixed(2)}, sous le seuil fourni.` }
}

// ── plan-check-5 — volume d'intervalles (R19) ──────────────────────────────

/**
 * Volume d'intervalles par séance plus épuisant que les modèles
 * d'entraîneurs de haut niveau → WARN. R19 est un constat qualitatif
 * (12 entraîneurs norvégiens interrogés), sans chiffre exploitable ni base
 * de comparaison dans cette app — renvoie toujours `insufficient_data`,
 * jamais un seuil inventé. Voir Q7.
 */
export function checkIntervalVolume(): PlanCheckResult {
  return {
    checkId: 'plan-check-5-interval-volume',
    verdict: 'insufficient_data',
    detail:
      "R19 ne fournit aucun critère chiffré comparable, et aucune base de « modèles d'entraîneurs de haut niveau » n'existe dans cette app — appréciation qualitative laissée au modèle plutôt qu'un calcul déterministe.",
  }
}

// ── plan-check-6 — sommeil planifié avant une séance clé (R28/R29) ────────

export interface PlannedSleepNight {
  date: string
  plannedSleepHours: number
  /** Besoin de sommeil perçu de l'athlète — individualisé (R28), jamais une norme 7-9h universelle. */
  perceivedSleepNeedHours: number
  isKeySession: boolean
}

/** Nuits < besoin perçu prévues avant une séance clé → WARN. Comparaison directe, aucun seuil à inventer. */
export function checkPlannedSleepBeforeKeySession(nights: PlannedSleepNight[]): PlanCheckResult {
  const checkId = 'plan-check-6-planned-sleep'
  if (nights.length === 0) return { checkId, verdict: 'insufficient_data', detail: 'Aucune nuit planifiée fournie.' }

  const shortfallDates = nights.filter((n) => n.isKeySession && n.plannedSleepHours < n.perceivedSleepNeedHours).map((n) => n.date)
  if (shortfallDates.length > 0) {
    return { checkId, verdict: 'warn', detail: `Nuit(s) planifiée(s) sous le besoin perçu avant une séance clé : ${shortfallDates.join(', ')}.` }
  }
  return { checkId, verdict: 'ok', detail: 'Sommeil planifié conforme au besoin perçu avant chaque séance clé.' }
}

// ── plan-check-7 — disponibilité énergétique (R35) ─────────────────────────

export interface DailyEnergyBalance {
  date: string
  /** Apports − dépense estimée (kcal) pour ce jour — négatif = apports insuffisants. */
  balanceKcal: number
}

/**
 * Apports planifiés incompatibles avec la dépense estimée → WARN, puis
 * BLOCK si persistant > 2 semaines. Le seuil de persistance (14 jours)
 * vient directement du texte de la règle (R35) — un jour "incompatible"
 * est un jour à bilan négatif (apports < dépense estimée) ; c'est la durée
 * de la plus longue série consécutive de jours négatifs qui décide
 * WARN vs BLOCK, pas un seuil de magnitude inventé.
 */
export function checkEnergyAvailability(days: DailyEnergyBalance[]): PlanCheckResult {
  const checkId = 'plan-check-7-energy-availability'
  if (days.length === 0) return { checkId, verdict: 'insufficient_data', detail: 'Aucun bilan énergétique fourni.' }

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  let longestNegativeStreak = 0
  let currentStreak = 0
  for (const day of sorted) {
    if (day.balanceKcal < 0) {
      currentStreak += 1
      longestNegativeStreak = Math.max(longestNegativeStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  const PERSISTENCE_THRESHOLD_DAYS = 14 // ">2 semaines", texte de la règle (R35)
  if (longestNegativeStreak > PERSISTENCE_THRESHOLD_DAYS) {
    return { checkId, verdict: 'block', detail: `Bilan énergétique négatif sur ${longestNegativeStreak} jours consécutifs (>${PERSISTENCE_THRESHOLD_DAYS}).` }
  }
  if (longestNegativeStreak > 0) {
    return { checkId, verdict: 'warn', detail: `Bilan énergétique négatif sur ${longestNegativeStreak} jour(s) consécutif(s).` }
  }
  return { checkId, verdict: 'ok', detail: 'Aucun déficit énergétique planifié.' }
}

// ── plan-check-8 — progression de charge sans décharge (R23) ──────────────

export type PlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery'

export interface PlanWeekLoad {
  weekNumber: number
  targetWeeklyMinutes: number
  phase: PlanPhase
}

/**
 * Hausse de charge chronique sans semaine de décharge sur 4 semaines →
 * WARN. Aucun seuil numérique à inventer : une semaine "recovery" (le
 * champ `phase` que trainingPlanGeneration produit déjà) EST la semaine de
 * décharge du modèle de périodisation de cette app — le contrôle regarde
 * si une fenêtre de 4 semaines consécutives a un volume net croissant
 * SANS aucune semaine "recovery" dedans.
 */
export function checkLoadProgressionWithoutDeload(weeks: PlanWeekLoad[]): PlanCheckResult {
  const checkId = 'plan-check-8-load-progression'
  const sorted = [...weeks].sort((a, b) => a.weekNumber - b.weekNumber)
  if (sorted.length < 4) return { checkId, verdict: 'insufficient_data', detail: 'Moins de 4 semaines à évaluer.' }

  for (let i = 0; i + 3 < sorted.length; i++) {
    const window = sorted.slice(i, i + 4)
    const nonDecreasing = window.every((w, idx) => idx === 0 || w.targetWeeklyMinutes >= window[idx - 1].targetWeeklyMinutes)
    const netIncrease = window[3].targetWeeklyMinutes > window[0].targetWeeklyMinutes
    const hasDeloadWeek = window.some((w) => w.phase === 'recovery')
    if (nonDecreasing && netIncrease && !hasDeloadWeek) {
      return {
        checkId,
        verdict: 'warn',
        detail: `Semaines ${window[0].weekNumber}-${window[3].weekNumber} : charge croissante sans semaine "recovery".`,
      }
    }
  }
  return { checkId, verdict: 'ok', detail: 'Décharge présente dans toute fenêtre de 4 semaines à charge croissante.' }
}

// ── plan-check-9 — traçabilité (convention) ────────────────────────────────

/**
 * Toute constante utilisée dans le plan doit être sourcée ou étiquetée
 * convention. Contrôle d'auto-cohérence : vérifie que chaque `checkId`
 * produit par les 8 autres contrôles correspond à une CoachRule réelle
 * (evidence/rules.ts) — jamais un id inventé qui échapperait au garde-fou
 * "aucune règle sans refs ni convention:true" (rules.test.ts).
 */
export function checkTraceability(otherResults: PlanCheckResult[]): PlanCheckResult {
  const checkId = 'plan-check-9-traceability'
  const knownRuleIds = new Set(RULES.map((r) => r.id))
  const untraceable = otherResults.filter((r) => !knownRuleIds.has(r.checkId)).map((r) => r.checkId)
  if (untraceable.length > 0) {
    return { checkId, verdict: 'block', detail: `Résultat(s) citant un id de règle inconnu : ${untraceable.join(', ')}.` }
  }
  return { checkId, verdict: 'ok', detail: 'Chaque contrôle cite une règle traçable dans evidence/rules.ts.' }
}

// ── Orchestrateur ───────────────────────────────────────────────────────────

export interface PlanValidationInput {
  weeklyLowIntensityPct: number | null
  plannedWeeklyKJPerKg: number | null
  calibratedCeilingKJPerKg: number | null
  accumulatedLoadDays: DayLoad[]
  monotony: number | null
  /** Obligatoire — aucun défaut, voir checkMonotony. */
  monotonyThreshold: number
  plannedSleepNights: PlannedSleepNight[]
  dailyEnergyBalance: DailyEnergyBalance[]
  weeks: PlanWeekLoad[]
}

export type PlanOverallVerdict = 'ok' | 'to-review' | 'blocked'

export interface PlanValidationSummary {
  results: PlanCheckResult[]
  /** ≥3 WARN (ou tout BLOCK) → "à revoir"/"bloqué", per le cadrage. */
  overallVerdict: PlanOverallVerdict
}

/** Exécute les 9 contrôles et calcule le verdict global. */
export function validatePlan(input: PlanValidationInput): PlanValidationSummary {
  const coreResults: PlanCheckResult[] = [
    checkIntensityDistribution(input.weeklyLowIntensityPct),
    checkKJBudget(input.plannedWeeklyKJPerKg, input.calibratedCeilingKJPerKg),
    checkAccumulatedLoadBeforeKeySession(input.accumulatedLoadDays),
    checkMonotony(input.monotony, input.monotonyThreshold),
    checkIntervalVolume(),
    checkPlannedSleepBeforeKeySession(input.plannedSleepNights),
    checkEnergyAvailability(input.dailyEnergyBalance),
    checkLoadProgressionWithoutDeload(input.weeks),
  ]
  const results = [...coreResults, checkTraceability(coreResults)]

  const hasBlock = results.some((r) => r.verdict === 'block')
  const warnCount = results.filter((r) => r.verdict === 'warn').length
  const overallVerdict: PlanOverallVerdict = hasBlock ? 'blocked' : warnCount >= 3 ? 'to-review' : 'ok'

  return { results, overallVerdict }
}
