// ── Arbitrage readiness → séance du jour — les 5 cas de la section 5 ───────
//
// Implémente EXACTEMENT la table à 5 cas de evidence/rules.ts (scope
// session-arbitration) — aucun seuil inventé ici, seulement la logique de
// priorité entre les 5 cas déjà écrite dans leur texte.
//
// Comme planValidator.ts (PR 9), ce module ne CLASSE pas lui-même les
// signaux bruts (HRV/bien-être/sommeil) — il reçoit des statuts déjà
// classés (`hrvStatus`, `wellbeingStatus`, un décompte de nuits
// restreintes) et applique la table de décision. La classification "HRV
// sous la limite basse" elle-même dépend d'un seuil (z-score/percentile
// par rapport à la baseline individuelle) qu'aucune des 35 références ne
// chiffre précisément — reste la responsabilité de l'appelant (typiquement
// governor-types.ts / use-governor.ts), pas de ce fichier.
//
// Priorité entre les cas — les 5 cas du texte ne couvrent pas explicitement
// TOUTES les combinaisons possibles des 3 dimensions (HRV/bien-être/
// sommeil) ; la cascade ci-dessous les évalue du plus sévère au plus
// favorable, cohérent avec principle-10-alert-overrides-performance (le
// signal le plus conservateur gagne toujours) :
// 1. arbitration-persistent-degradation-orients (les 3 dégradés) — le cas
//    le plus sévère, évalué en premier.
// 2. arbitration-sleep-restriction-overrides-feeling-fresh (≥2 nuits) —
//    "quel que soit le reste des signaux", donc évalué juste après le cas
//    encore plus sévère ci-dessus, avant tout le reste.
// 3. arbitration-wellbeing-overrides (bien-être dégradé, HRV correcte).
// 4. arbitration-low-hrv-reassess-48h (HRV basse isolée).
// 5. arbitration-nominal-case (repli, tout va bien).
// Une seule nuit de sommeil restreinte, seule (sans HRV basse ni bien-être
// dégradé), ne déclenche aucun cas explicite du texte (le seuil "≥2 nuits"
// du cas 4 l'exclut délibérément) — elle retombe donc sur le cas nominal,
// lecture directe du seuil déjà écrit, pas une simplification de ma part.

import type { CoachRule } from '../evidence/rules'

export type HrvStatus = 'within-or-above-baseline' | 'below-low-limit'
export type WellbeingStatus = 'normal' | 'degraded'

export interface ArbitrationInput {
  hrvStatus: HrvStatus
  wellbeingStatus: WellbeingStatus
  /** Nuits consécutives (jusqu'à aujourd'hui inclus) avec restriction de sommeil — le seuil "≥2" vient du texte de arbitration-sleep-restriction-overrides-feeling-fresh (R29). */
  consecutiveSleepRestrictionNights: number
  /** Jours consécutifs où ce même arbitrage a déjà recommandé le repos — le seuil ">7" vient du texte de arbitration-persistent-degradation-orients (R23). 0 si aucun repos recommandé la veille. */
  consecutiveRestDaysRecommended: number
}

export type ArbitrationDecision = 'planned-session' | 'low-intensity' | 'rest' | 'orient-to-professional'

export interface ArbitrationResult {
  decision: ArbitrationDecision
  /** Id de la CoachRule (evidence/rules.ts, scope session-arbitration) qui a produit cette décision. */
  matchedCaseId: CoachRule['id']
  detail: string
  /** Présent seulement pour le cas 3 (HRV basse isolée) — le texte de la règle demande une réévaluation à 48h, pas un signal permanent. */
  reassessInHours?: number
}

const SLEEP_RESTRICTION_OVERRIDE_NIGHTS = 2 // texte de arbitration-sleep-restriction-overrides-feeling-fresh (R29)
const PERSISTENT_DEGRADATION_ORIENT_DAYS = 7 // texte de arbitration-persistent-degradation-orients (R23)
const LOW_HRV_REASSESS_HOURS = 48 // texte de arbitration-low-hrv-reassess-48h (R25)

/** Arbitre la séance du jour selon la table à 5 cas de la section 5 (voir le commentaire d'en-tête pour la priorité entre cas). */
export function arbitrateSession(input: ArbitrationInput): ArbitrationResult {
  const { hrvStatus, wellbeingStatus, consecutiveSleepRestrictionNights, consecutiveRestDaysRecommended } = input
  const hrvLow = hrvStatus === 'below-low-limit'
  const wellbeingDegraded = wellbeingStatus === 'degraded'
  const sleepRestricted = consecutiveSleepRestrictionNights >= 1
  const sleepRestrictionOverride = consecutiveSleepRestrictionNights >= SLEEP_RESTRICTION_OVERRIDE_NIGHTS

  // Cas 5 — les 3 signaux dégradés simultanément, le plus sévère.
  if (hrvLow && wellbeingDegraded && sleepRestricted) {
    if (consecutiveRestDaysRecommended > PERSISTENT_DEGRADATION_ORIENT_DAYS) {
      return {
        decision: 'orient-to-professional',
        matchedCaseId: 'arbitration-persistent-degradation-orients',
        detail: `HRV basse, bien-être dégradé et sommeil dégradé persistant depuis ${consecutiveRestDaysRecommended} jours (>${PERSISTENT_DEGRADATION_ORIENT_DAYS}) — orientation plutôt qu'un simple ajustement.`,
      }
    }
    return {
      decision: 'rest',
      matchedCaseId: 'arbitration-persistent-degradation-orients',
      detail: 'HRV basse, bien-être dégradé et sommeil dégradé simultanément — repos.',
    }
  }

  // Cas 4 — restriction de sommeil ≥2 nuits, prime sur le reste des signaux.
  if (sleepRestrictionOverride) {
    return {
      decision: 'low-intensity',
      matchedCaseId: 'arbitration-sleep-restriction-overrides-feeling-fresh',
      detail: `${consecutiveSleepRestrictionNights} nuits consécutives de restriction de sommeil (≥${SLEEP_RESTRICTION_OVERRIDE_NIGHTS}) — basse intensité même si l'athlète se déclare frais.`,
    }
  }

  // Cas 2 — bien-être dégradé prime sur une HRV correcte (le subjectif l'emporte).
  if (wellbeingDegraded) {
    return {
      decision: 'low-intensity',
      matchedCaseId: 'arbitration-wellbeing-overrides',
      detail: "Bien-être dégradé malgré une HRV correcte — le signal subjectif l'emporte, basse intensité.",
    }
  }

  // Cas 3 — HRV basse isolée.
  if (hrvLow) {
    return {
      decision: 'low-intensity',
      matchedCaseId: 'arbitration-low-hrv-reassess-48h',
      detail: 'HRV sous la limite basse, bien-être et sommeil normaux — basse intensité, à réévaluer.',
      reassessInHours: LOW_HRV_REASSESS_HOURS,
    }
  }

  // Cas 1 — nominal.
  return {
    decision: 'planned-session',
    matchedCaseId: 'arbitration-nominal-case',
    detail: 'HRV dans/au-dessus de la ligne de base, bien-être normal, sommeil conforme — séance prévue.',
  }
}
