// ── Métabolisme de base — équation Ten-Haaf (R32/R33) ──────────────────────
//
// R32 (revue systématique + méta-analyse, niveau A) compare 5 équations de
// métabolisme de base chez l'athlète (Cunningham 1980/1991, Harris-Benedict
// 1918, De Lorenzo, Ten-Haaf) : toutes sauf Ten-Haaf présentent une forte
// hétérogénéité (I²>0%) ; Ten-Haaf prédit 80,2% des sujets à ±10%, contre
// 40,7-63,7% pour les autres. C'est pour ça que nutrition-bmr-ten-haaf-
// default (evidence/rules.ts) fait de Ten-Haaf l'équation par défaut de ce
// projet — PAS Mifflin-St Jeor.
//
// ⚠️ Écart actif avec l'existant, à noter : `computeBMR()`
// (src/components/nutrition/fueling-types.ts, tuile Fueling vs Workload)
// utilise aujourd'hui Mifflin-St Jeor — une équation que R32 ne teste même
// pas (les 5 équations comparées n'incluent pas Mifflin-St Jeor) et qui
// n'a donc aucune source dans les 35+ références de ce projet. TEN_HAAF_
// COEFFICIENTS (evidence/constants.ts) est désormais rempli (voir son
// commentaire pour le détail du sourcing par triangulation, network sandbox
// oblige) — ce module calcule donc réellement Ten-Haaf maintenant — mais le
// remplacement de `computeBMR()`/la tuile Fueling vs Workload par cette
// fonction reste une décision UI distincte, pas encore prise (scope de ce
// chantier : "sourcer les coefficients", pas "remplacer Mifflin-St Jeor
// partout").
//
// R33 (ten Haaf & Weijs 2014, source primaire) donne deux variantes de
// l'équation — masse corporelle (poids/taille/âge/sexe) et masse maigre
// (FFM seule, plus précise quand connue) — voir TEN_HAAF_COEFFICIENTS pour
// les coefficients exacts et leur sourcing.

import { TEN_HAAF_COEFFICIENTS, requireConstant } from '../evidence/constants'

/** 4,184 kJ = 1 kcal — conversion physique standard, pas une constante scientifique sourcée (voir la même note dans fueling-types.ts pour le budget kJ). */
const KJ_PER_KCAL = 4.184

export interface TenHaafInput {
  weightKg: number
  /** Taille (cm) — nécessaire pour la variante masse corporelle, ignorée si `fatFreeMassKg` est fourni. */
  heightCm: number
  /** Âge (années) — nécessaire pour la variante masse corporelle, ignorée si `fatFreeMassKg` est fourni. */
  age: number
  /** Sexe — nécessaire pour la variante masse corporelle, ignoré si `fatFreeMassKg` est fourni. */
  sex: 'male' | 'female'
  /** Masse maigre (kg), si connue — R33 fournit une variante dédiée, plus précise que la version masse corporelle seule quand disponible. */
  fatFreeMassKg?: number | null
}

export type RestingMetabolicRateMethod = 'ten-haaf-body-mass' | 'ten-haaf-fat-free-mass'

export interface RestingMetabolicRateEstimate {
  kcalPerDay: number
  method: RestingMetabolicRateMethod
}

/**
 * Estimation du métabolisme de base via l'équation Ten-Haaf (R32/R33),
 * équation par défaut de ce projet (nutrition-bmr-ten-haaf-default) —
 * utilise la variante masse maigre si `fatFreeMassKg` est fournie (et > 0),
 * sinon la variante masse corporelle (poids/taille/âge/sexe). Les
 * coefficients du papier sont en kJ/jour — convertis en kcal/jour ici
 * (division par 4,184) pour rester dans l'unité déjà utilisée partout
 * ailleurs dans l'app (voir computeBMR()/sessionEnergyBurnedKcal() dans
 * fueling-types.ts).
 */
export function computeRestingMetabolicRate(input: TenHaafInput): RestingMetabolicRateEstimate {
  const coefficients = requireConstant(TEN_HAAF_COEFFICIENTS, 'TEN_HAAF_COEFFICIENTS')

  if (input.fatFreeMassKg != null && input.fatFreeMassKg > 0) {
    const { fatFreeMassKJPerKg, constantKJ } = coefficients.fatFreeMass
    const kJPerDay = fatFreeMassKJPerKg * input.fatFreeMassKg + constantKJ
    return { kcalPerDay: Math.round(kJPerDay / KJ_PER_KCAL), method: 'ten-haaf-fat-free-mass' }
  }

  const { weightKJPerKg, heightKJPerM, ageKJPerYear, maleKJ, constantKJ } = coefficients.bodyMass
  const heightM = input.heightCm / 100
  const kJPerDay =
    weightKJPerKg * input.weightKg +
    heightKJPerM * heightM -
    ageKJPerYear * input.age +
    (input.sex === 'male' ? maleKJ : 0) +
    constantKJ
  return { kcalPerDay: Math.round(kJPerDay / KJ_PER_KCAL), method: 'ten-haaf-body-mass' }
}
