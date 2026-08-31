// ── Modèle Puissance Critique / W′ (R14/R15) ───────────────────────────────
//
// R14 (Jones et al. 2010) : relation hyperbolique puissance-durée,
// P = W′/t + CP — CP (asymptote) est la puissance théoriquement soutenable
// indéfiniment, W′ (constante de courbure) la réserve de travail finie
// disponible au-dessus de CP. L'interprétation classique "CP=aérobie,
// W′=anaérobie" est explicitement qualifiée de simpliste par R14 lui-même
// (les deux paramètres sont interdépendants) — ce module ne prétend donc
// jamais que CP soit un "seuil aérobie pur".
//
// riegel-prefer-critical-power-side-cycling (R14) : ce modèle est
// l'alternative à privilégier côté vélo par rapport au fit Riegel
// (endurance.ts) — physiologiquement fondé plutôt qu'un ajustement
// statistique pur.
//
// ⚠️ Deux volets bien distincts, seul l'un des deux nécessite la constante
// pending :
// 1. **Estimer CP/W′** (fitCriticalPower ci-dessous) — régression linéaire
//    de Travail (P×t) vs Durée sur les records personnels déjà disponibles
//    (settings/powerCurve). C'est de l'algèbre appliquée au modèle R14
//    lui-même (Travail = CP·t + W′, forme linéaire de l'hyperbole
//    puissance-durée) — AUCUNE constante pending requise, livrable
//    aujourd'hui.
// 2. **Reconstituer W′ pendant la récupération sous CP** — nécessite la
//    constante de temps τ de Skiba et al. 2012 (R15,
//    W_PRIME_RECONSTITUTION_CONSTANT), toujours pending. Seule
//    wPrimeReconstitutionRate() ci-dessous en dépend, et lève
//    systématiquement aujourd'hui.
//
// La **déplétion** de W′ pendant un effort au-dessus de CP (Q6,
// docs/OPEN_QUESTIONS.md, réponse utilisateur du 31 août 2026) ne nécessite
// PAS non plus la constante pending — c'est une simple reformulation de
// l'équation de R14 : W′ consommée = (P − CP) × t. computeWPrimeBalance
// ci-dessous l'utilise pour modéliser le solde pendant un effort, mais
// reste EXPLICITEMENT une modélisation "déplétion seule" (le solde ne
// remonte jamais sous CP, faute de la constante de reconstitution) —
// jamais présentée comme le vrai W′ balance de Skiba complet tant que R15
// n'est pas remplie (voir ride-analysis-4-w-prime-balance dans
// evidence/rules.ts, qui exige la vraie reconstitution).

import { W_PRIME_RECONSTITUTION_CONSTANT, requireConstant } from '../evidence/constants'

export interface PowerRecord {
  seconds: number
  watts: number
}

export interface CriticalPowerModel {
  cpWatts: number
  wPrimeJoules: number
}

/**
 * Régression linéaire aux moindres carrés de Travail (P×t, Joules) vs
 * Durée (t, secondes) sur les records personnels — forme linéaire de
 * l'hyperbole puissance-durée de R14 (Travail = CP·t + W′ : la pente EST
 * la CP, l'ordonnée à l'origine EST le W′). Nécessite ≥2 records valides.
 * `null` si dégénéré : CP ou W′ non positifs (interprétation physiologique
 * impossible), ou durées toutes identiques.
 */
export function fitCriticalPower(records: PowerRecord[]): CriticalPowerModel | null {
  const valid = records.filter((r) => r.seconds > 0 && r.watts > 0)
  if (valid.length < 2) return null

  const xs = valid.map((r) => r.seconds)
  const ys = valid.map((r) => r.watts * r.seconds) // travail, Joules
  const n = valid.length
  const sumX = xs.reduce((acc, x) => acc + x, 0)
  const sumY = ys.reduce((acc, y) => acc + y, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0)

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null // toutes les durées identiques, pas de pente calculable

  const cpWatts = (n * sumXY - sumX * sumY) / denom
  const wPrimeJoules = (sumY - cpWatts * sumX) / n
  if (cpWatts <= 0 || wPrimeJoules <= 0) return null // dégénéré, pas d'interprétation physiologique valide

  return { cpWatts, wPrimeJoules }
}

/**
 * Taux de déplétion instantané de W′ (Joules/s) à une puissance donnée —
 * 0 en dessous ou à la CP (pas de dépense de la réserve anaérobie dans ce
 * modèle), sinon l'écart (P − CP) lui-même (R14/R15, voir Q6). Chaque watt
 * supplémentaire au-dessus de CP est un multiplicateur direct du taux de
 * déplétion — aucune constante empirique supplémentaire nécessaire.
 */
export function wPrimeDepletionRateWatts(instantWatts: number, cpWatts: number): number {
  return Math.max(0, instantWatts - cpWatts)
}

/**
 * Solde de W′ balance (Joules) échantillon par échantillon, en supposant
 * un flux 1Hz — **déplétion seule** : la réserve ne se reconstitue JAMAIS
 * sous CP dans cette fonction (faute de la constante de temps τ, R15,
 * toujours pending — voir wPrimeReconstitutionRate ci-dessous). C'est donc
 * un solde pessimiste/plancher, jamais le vrai W′ balance de Skiba
 * complet : utile pour une lecture "pire cas" de l'épuisement pendant un
 * effort soutenu au-dessus de CP, PAS pour représenter la récupération
 * réelle entre deux efforts (ride-analysis-4-w-prime-balance exige la
 * vraie reconstitution, non disponible ici).
 */
export function computeWPrimeBalanceDepletionOnly(watts: number[], cpWatts: number, wPrimeMaxJoules: number): number[] {
  let balance = wPrimeMaxJoules
  return watts.map((w) => {
    balance -= wPrimeDepletionRateWatts(w, cpWatts)
    return balance
  })
}

/**
 * Constante de temps de reconstitution de W′ sous CP (Skiba et al. 2012,
 * R15) — lève systématiquement aujourd'hui : la formule générale (τ en
 * fonction de l'écart CP − puissance de récupération) n'a pas encore été
 * extraite du papier source (voir W_PRIME_RECONSTITUTION_CONSTANT,
 * evidence/constants.ts). Jamais un ordre de grandeur approximatif utilisé
 * à la place.
 */
export function wPrimeReconstitutionRate(_cpWatts: number, _recoveryWatts: number): number {
  // requireConstant<number>() lève systématiquement aujourd'hui (constante
  // pending) — pas de formule à écrire tant que R15 n'a pas été extraite
  // du papier source ; jamais un ordre de grandeur approximatif en repli.
  return requireConstant<number>(W_PRIME_RECONSTITUTION_CONSTANT, 'W_PRIME_RECONSTITUTION_CONSTANT')
}
