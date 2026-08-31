// ── Nutrition — glucides à l'effort (R34) et cadre REDs (R35) ──────────────
//
// Deux préoccupations distinctes, chacune volontairement limitée à ce que
// les références sourcées donnent réellement, sans combler les trous par
// une formule inventée :
//
// - **Glucides à l'effort (R34)** : Podlogar & Wallis (2022) donnent un
//   plafond (jusqu'à 120g·h⁻¹) et un ratio glucose:fructose (~1:0,8) pour
//   les efforts intenses — mais aucune formule reliant durée/intensité à
//   un débit précis en g/h. `carbIntakeGuidance()` expose donc le plafond
//   et le ratio sourcés tels quels, jamais un barème par tranche de durée
//   inventé pour combler ce trou.
// - **Cadre REDs (R35)** : le consensus IOC 2023 documente un continuum de
//   disponibilité énergétique et une liste de signaux d'alerte (LEA
//   persistante, perte de poids non planifiée, fracture de fatigue,
//   troubles du sommeil/hormonaux — voir la règle red-flag-reds), mais ne
//   donne pas les critères chiffrés exacts de son outil clinique en 3
//   étapes (dépistage/stratification/diagnostic — un vrai questionnaire
//   validé, hors de portée d'une simple règle de décision). `assessREDsRisk()`
//   se limite donc à la liste de signaux déjà sourcée, en entrée déjà
//   qualifiée par l'appelant — jamais un score ou un diagnostic inventé.
//   La persistance d'un déficit énergétique (>14 jours) est déjà calculée
//   par planValidator.ts (checkEnergyAvailability, plan-check-7) — réutilisée
//   ici comme un des signaux d'entrée, pas recalculée.

import { CARB_INTAKE_GUIDANCE, requireConstant } from '../evidence/constants'

export interface CarbIntakeGuidance {
  maxGramsPerHour: number
  glucoseFructoseRatio: [number, number]
}

/**
 * Plafond de référence et ratio glucose:fructose sourcés (R34) pour
 * l'apport glucidique pendant un effort intense — pas un calculateur
 * personnalisé par durée/intensité (aucune formule de ce type n'est
 * donnée par la source).
 */
export function carbIntakeGuidance(): CarbIntakeGuidance {
  return requireConstant(CARB_INTAKE_GUIDANCE, 'CARB_INTAKE_GUIDANCE')
}

export interface REDsRiskInput {
  /** Bilan énergétique négatif persistant (>14 jours, voir planValidator.ts checkEnergyAvailability) — calculé ailleurs, fourni ici en entrée. */
  persistentEnergyDeficit: boolean
  unplannedWeightLoss: boolean
  stressFractureHistory: boolean
  sleepOrHormonalIssues: boolean
}

export interface REDsRiskSignal {
  key: keyof REDsRiskInput
  label: string
}

/** Les 4 signaux d'alerte REDs, dans l'ordre du texte de la règle red-flag-reds (R35). */
export const REDS_RISK_SIGNALS: REDsRiskSignal[] = [
  { key: 'persistentEnergyDeficit', label: 'Faible disponibilité énergétique répétée' },
  { key: 'unplannedWeightLoss', label: 'Perte de poids non planifiée' },
  { key: 'stressFractureHistory', label: 'Fracture de fatigue' },
  { key: 'sleepOrHormonalIssues', label: 'Troubles du sommeil ou hormonaux' },
]

export interface REDsRiskResult {
  /** true dès qu'au moins un signal est présent — le cadre REDs s'applique, per red-flag-reds (R35). */
  flagged: boolean
  reasons: string[]
}

/**
 * Traduit directement la règle red-flag-reds (R35) : dès qu'un des 4
 * signaux déjà sourcés est présent, le cadre REDs s'applique — abandonner
 * l'optimisation et orienter (principle-10-alert-overrides-performance),
 * pas continuer à chercher une performance. Ne diagnostique rien —
 * `flagged` signale seulement qu'une évaluation professionnelle est
 * indiquée, jamais un score de sévérité inventé.
 */
export function assessREDsRisk(input: REDsRiskInput): REDsRiskResult {
  const reasons = REDS_RISK_SIGNALS.filter((s) => input[s.key]).map((s) => s.label)
  return { flagged: reasons.length > 0, reasons }
}
