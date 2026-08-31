// ── Indice d'endurance — fit Riegel individuel (R12/R13) ───────────────────
//
// Fait évoluer src/components/cycling/riegel-types.ts (existant, préexistant
// à cette refonte) vers le domaine évidence-based — même mathématique
// (régression log-log P = a·t^(−e) sur les records personnels de
// l'athlète), mais désormais explicitement adossée aux règles sourcées :
//
// - riegel-never-running-exponent (R12) : jamais l'exposant historique de
//   la course à pied — ce module ne le fait déjà pas (aucune constante
//   universelle, uniquement un fit individuel), mais voir aussi le
//   garde-fou CI qui bannit le littéral lui-même du domaine cyclisme.
// - riegel-calibrate-individual-exponent (R13) : un modèle calibré sur les
//   performances propres de l'athlète (≥2 records) divise l'erreur par
//   deux par rapport à une constante universelle — c'est le chemin
//   PRINCIPAL et déjà pleinement disponible, aucune constante pending
//   requise.
// - riegel-validity-domain (R12) : domaine de validité du fit, ~3,5 à
//   230 min (RIEGEL_VALIDITY_DOMAIN, evidence/constants.ts) — le texte
//   source dit "avertir" hors de cette plage, pas "refuser" : ce module
//   renvoie donc toujours la valeur calculée, accompagnée d'un indicateur
//   explicite plutôt que de la masquer.
// - riegel-prefer-critical-power-side-cycling (R14) : le modèle CP/W′
//   (criticalPower.ts, physiologiquement fondé) reste l'alternative à
//   privilégier côté vélo — ce module n'est pas le seul outil, voir
//   criticalPower.ts à côté.
//
// Le SEUL chemin qui dépend de RIEGEL_CYCLING_FATIGUE_EXPONENT (pending,
// R12) est le repli théorique quand moins de 2 records existent —
// fallbackFatigueExponent() ci-dessous lève systématiquement aujourd'hui,
// jamais de valeur inventée à sa place.

import { RIEGEL_CYCLING_FATIGUE_EXPONENT, RIEGEL_VALIDITY_DOMAIN, requireConstant } from '../evidence/constants'

export interface PowerRecord {
  seconds: number
  watts: number
}

export interface EnduranceCurve {
  a: number // P(1s), intercept de la courbe ajustée
  e: number // exposant de fatigue individuel (plus petit = meilleure endurance)
  enduranceIndex: number // 1 - e, typiquement 0,85-0,95
}

/**
 * Régression aux moindres carrés de P = a·t^(−e) via log(P) vs log(t) sur
 * les records personnels. Nécessite ≥2 records valides (durée et
 * puissance positives) — `null` sinon, jamais un repli sur une constante
 * universelle (voir riegel-calibrate-individual-exponent).
 */
export function fitEnduranceCurve(records: PowerRecord[]): EnduranceCurve | null {
  const valid = records.filter((r) => r.seconds > 0 && r.watts > 0)
  if (valid.length < 2) return null

  const xs = valid.map((r) => Math.log(r.seconds))
  const ys = valid.map((r) => Math.log(r.watts))
  const n = valid.length
  const sumX = xs.reduce((acc, x) => acc + x, 0)
  const sumY = ys.reduce((acc, y) => acc + y, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null // toutes les durées identiques, pas de pente calculable

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const e = -slope
  if (e <= 0) return null // dégénéré : la puissance ne décroît pas avec la durée

  return { a: Math.exp(intercept), e, enduranceIndex: 1 - e }
}

/** Temps jusqu'à épuisement théorique (secondes) à `targetWatts`, selon la courbe ajustée. `null` si non calculable. */
export function computeTTE(targetWatts: number, curve: EnduranceCurve): number | null {
  if (targetWatts <= 0 || curve.e <= 0) return null
  return Math.pow(curve.a / targetWatts, 1 / curve.e)
}

export interface RiegelValidityCheck {
  seconds: number
  /** `false` hors du domaine ~3,5-230min (R12) — un avertissement à afficher, pas une raison de masquer la valeur. */
  withinValidityDomain: boolean
}

/**
 * Situe une durée (secondes) par rapport au domaine de validité sourcé du
 * fit Riegel (riegel-validity-domain, R12). Le texte source dit "avertir",
 * jamais "refuser" — la valeur elle-même reste utilisable, ce check sert
 * uniquement à décider d'afficher un avertissement.
 */
export function checkRiegelValidityDomain(seconds: number): RiegelValidityCheck {
  const domain = requireConstant(RIEGEL_VALIDITY_DOMAIN, 'RIEGEL_VALIDITY_DOMAIN')
  return { seconds, withinValidityDomain: seconds >= domain.minSeconds && seconds <= domain.maxSeconds }
}

/** Les records dont la durée tombe hors du domaine de validité sourcé — à signaler, jamais à exclure silencieusement du fit. */
export function recordsOutsideValidityDomain(records: PowerRecord[]): PowerRecord[] {
  return records.filter((r) => !checkRiegelValidityDomain(r.seconds).withinValidityDomain)
}

/**
 * Difficulté relative d'une séance : ratio durée réelle / TTE théorique à
 * la même puissance — proche de 1 signifie une séance courue près de la
 * limite physiologique pour cette durée. `null` si le TTE n'est pas
 * calculable.
 */
export function difficultyRatio(sessionSeconds: number, sessionWatts: number, curve: EnduranceCurve): number | null {
  const tte = computeTTE(sessionWatts, curve)
  if (tte == null || tte <= 0) return null
  return sessionSeconds / tte
}

/**
 * Repli théorique quand aucune calibration individuelle n'est possible
 * (moins de 2 records personnels) — R12, l'exposant de fatigue cyclisme
 * spécifique de Riegel, distinct de l'exposant historique de la course à
 * pied. Lève systématiquement aujourd'hui : la valeur n'a pas encore été
 * extraite du papier source (voir RIEGEL_CYCLING_FATIGUE_EXPONENT,
 * evidence/constants.ts) — jamais un nombre inventé à sa place.
 */
export function fallbackFatigueExponent(): number {
  return requireConstant(RIEGEL_CYCLING_FATIGUE_EXPONENT, 'RIEGEL_CYCLING_FATIGUE_EXPONENT')
}
