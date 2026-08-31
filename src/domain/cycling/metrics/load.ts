// ── Charge d'entraînement — session-RPE, monotonie, strain (R21) ──────────
//
// Foster et al. (2001, R21) : session-RPE = RPE (0-10) × durée (min),
// quantification de la charge indépendante du mode et de l'intensité,
// avec des relations quasi superposées à la méthode de référence basée sur
// la FC. Foster (1998, compagnon cité dans R21) introduit monotonie
// (moyenne / écart-type de la charge quotidienne sur 7 jours) et strain
// (charge hebdomadaire totale × monotonie), tous deux reliés à l'incidence
// de maladies bénignes dans la littérature source.

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** session-RPE d'une séance = RPE (0-10, saisi ≥10min après l'effort) × durée en minutes. */
export function computeSessionRPE(rpe: number, durationMinutes: number): number {
  return rpe * durationMinutes
}

/** Charge quotidienne = somme des session-RPE de toutes les séances du jour (0 si aucune séance). */
export function computeDailyLoad(sessionRPEs: number[]): number {
  return sessionRPEs.reduce((sum, v) => sum + v, 0)
}

/**
 * Monotonie = moyenne / écart-type de la charge quotidienne sur la fenêtre
 * fournie (généralement 7 jours glissants). Écart-type de population
 * (division par N, pas N-1) — le document source ne précise pas lequel des
 * deux utiliser pour cette métrique, l'écart-type de population est la
 * convention la plus citée dans la littérature/les outils d'entraînement
 * pour cette formule précise ; un choix d'implémentation, pas une donnée
 * scientifique à sourcer.
 *
 * Retourne `null` (jamais `Infinity`/`NaN`) si l'écart-type est nul (charge
 * parfaitement constante sur la fenêtre — le ratio n'est mathématiquement
 * pas défini) ou s'il y a moins de 2 jours de données.
 */
export function computeMonotony(dailyLoads: number[]): number | null {
  if (dailyLoads.length < 2) return null
  const mean = average(dailyLoads)
  const variance = average(dailyLoads.map((v) => (v - mean) ** 2))
  const sd = Math.sqrt(variance)
  if (sd === 0) return null
  return mean / sd
}

/**
 * Strain = charge hebdomadaire totale × monotonie. `null` si la monotonie
 * n'est pas calculable (voir computeMonotony) — jamais une valeur inventée
 * pour combler l'absence de signal.
 */
export function computeStrain(dailyLoads: number[]): number | null {
  const monotony = computeMonotony(dailyLoads)
  if (monotony == null) return null
  const weeklyLoad = dailyLoads.reduce((sum, v) => sum + v, 0)
  return weeklyLoad * monotony
}
