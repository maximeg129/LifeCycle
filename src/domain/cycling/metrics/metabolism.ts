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
// n'a donc aucune source dans les 35 références de ce projet. Ce n'est pas
// corrigé dans cette PR (voir plus bas — module domaine pur, pas encore
// branché, même posture que kj.ts/durability.ts/endurance.ts), mais c'est
// documenté ici pour la Phase 5 (UI) : le vrai remplacement ne pourra se
// faire qu'une fois TEN_HAAF_COEFFICIENTS rempli.
//
// R33 (ten Haaf & Weijs 2014, source primaire) prévient explicitement que
// les coefficients exacts (deux variantes : masse corporelle ET masse
// maigre) doivent être repris tels quels dans le tableau du papier, jamais
// reconstitués de mémoire — TEN_HAAF_COEFFICIENTS (evidence/constants.ts)
// reste `pending` pour cette raison précise. **Ce module entier dépend de
// cette seule constante** : contrairement à endurance.ts/criticalPower.ts
// (PR 6), qui avaient chacun un chemin principal indépendant des
// constantes pending, il n'existe aucune formule de métabolisme de base
// dans les 35 références qui soit à la fois sourcée ET déjà chiffrée dans
// ce projet — utiliser autre chose ici (Mifflin-St Jeor, Harris-Benedict)
// serait inventer une source hors du canon. computeRestingMetabolicRate()
// lève donc systématiquement aujourd'hui, en citant R33.

import { TEN_HAAF_COEFFICIENTS, requireConstant } from '../evidence/constants'

export interface TenHaafInput {
  weightKg: number
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
 * utilise la variante masse maigre si `fatFreeMassKg` est fournie, sinon
 * la variante masse corporelle. Lève systématiquement aujourd'hui :
 * TEN_HAAF_COEFFICIENTS est toujours `pending` — jamais un calcul avec des
 * coefficients approximés ou une équation de repli non sourcée (Mifflin-
 * St Jeor, Harris-Benedict) à la place.
 */
export function computeRestingMetabolicRate(_input: TenHaafInput): RestingMetabolicRateEstimate {
  // requireConstant<...>() lève avant d'atteindre quoi que ce soit
  // d'autre — pas de formule à écrire tant que R33 n'a pas été extraite du
  // papier source. Conservé typé (plutôt que `never`) pour documenter la
  // forme de sortie attendue une fois la constante remplie.
  return requireConstant<RestingMetabolicRateEstimate>(TEN_HAAF_COEFFICIENTS, 'TEN_HAAF_COEFFICIENTS')
}
