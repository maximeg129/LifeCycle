// ── Durabilité — MMP par palier de travail accumulé (R07/R08/R10) ─────────
//
// Le cœur différenciant du produit (voir docs/AUDIT_CYCLING.md §5 : "aucun
// équivalent n'existe" ; instruction explicite : "sur-teste-le"). Ce n'est
// PAS l'indice d'endurance de Riegel (endurance.ts, un modèle différent,
// voir la règle riegel-never-running-exponent dans evidence/rules.ts) et ça
// ne se déduit pas des tests labo — VT/PMA/VO₂max ne prédisent pas la
// dégradation (règle kj-budget-durability-not-from-lab-tests, R08).
//
// Protocole (règle ride-analysis-2-power-profile-by-accumulated-tier,
// R07/R08/R10) : "Extraire le profil de puissance (MMP 10s/1/5/12/20/40min)
// aux paliers 0/10/20/30/40 kJ/kg et le comparer à l'historique de
// l'athlète au MÊME palier — seule lecture valide de la durabilité." Donc
// deux règles strictes que ce module respecte :
//   1. jamais de comparaison à un seuil labo ou à un autre athlète — un
//      athlète n'est comparé qu'à lui-même, au même palier, à la même
//      durée ;
//   2. le kJ/kg (jamais le kJ brut) est l'unité du palier — voir
//      kj-budget-unit-kj-per-kg dans evidence/rules.ts.
//
// Les paliers 10/20/30/40 kJ/kg viennent de evidence/constants.ts
// (KJ_DURABILITY_THRESHOLDS, déjà sourcé R08/R10/R11) plutôt que d'être
// répétés ici en dur — 0 est le palier "à froid" que la règle ajoute
// elle-même comme référence de pré-fatigue. Les 6 durées de MMP (10s à
// 40min) viennent du texte exact de cette même règle, déjà sourcée.

import { KJ_DURABILITY_THRESHOLDS, requireConstant } from '../evidence/constants'

/** Durées de MMP testées à chaque palier (secondes) — texte de la règle ride-analysis-2-power-profile-by-accumulated-tier (R07/R08/R10) : 10s/1/5/12/20/40min. */
export const DURABILITY_TEST_DURATIONS_SECONDS = [10, 60, 300, 720, 1200, 2400] as const

/**
 * Paliers de travail accumulé testés (kJ/kg) : 0 (à froid, référence) puis
 * les 4 seuils déjà sourcés dans KJ_DURABILITY_THRESHOLDS (R08/R10/R11) —
 * jamais une nouvelle valeur inventée ici.
 */
export function durabilityTiersKJPerKg(): number[] {
  const t = requireConstant(KJ_DURABILITY_THRESHOLDS, 'KJ_DURABILITY_THRESHOLDS')
  return [
    0,
    t.firstMeasurableDeclineKJPerKg,
    t.womenDivergenceStartKJPerKg,
    t.womenDivergenceAmplifiesKJPerKg,
    t.proDegradationKJPerKg,
  ]
}

/**
 * Travail mécanique cumulé (kJ), échantillon par échantillon, en supposant
 * un flux 1Hz (1 valeur watts = 1 seconde). Suite croissante, jamais
 * décroissante.
 */
export function computeAccumulatedWorkKJ(watts: number[]): number[] {
  let cumulative = 0
  return watts.map((w) => {
    cumulative += w / 1000
    return cumulative
  })
}

/**
 * Puissance maximale moyenne (MMP) sur une fenêtre glissante de
 * `durationSeconds` dans le segment `watts` fourni. `null` si le segment
 * est plus court que la durée demandée, ou si `durationSeconds` n'est pas
 * positif — jamais une moyenne calculée sur une fenêtre partielle qui
 * laisserait croire à une vraie MMP.
 */
export function maxMeanPower(watts: number[], durationSeconds: number): number | null {
  if (durationSeconds <= 0 || watts.length < durationSeconds) return null

  let windowSum = 0
  for (let i = 0; i < durationSeconds; i++) windowSum += watts[i]
  let best = windowSum

  for (let i = durationSeconds; i < watts.length; i++) {
    windowSum += watts[i] - watts[i - durationSeconds]
    if (windowSum > best) best = windowSum
  }

  return best / durationSeconds
}

export interface DurabilityTierProfile {
  tierKJPerKg: number
  /** Index du premier échantillon où le travail accumulé atteint ce palier — `null` si ce palier n'a jamais été atteint sur cette sortie. */
  reachedAtSampleIndex: number | null
  /** MMP (W) par durée testée, calculée uniquement sur le segment de la sortie APRÈS ce palier. `null` par durée si le segment restant est trop court ; toutes `null` si le palier n'est jamais atteint. */
  mmpByDurationSeconds: Partial<Record<(typeof DURABILITY_TEST_DURATIONS_SECONDS)[number], number | null>>
}

/**
 * Profil de durabilité d'une sortie : pour chaque palier de travail
 * accumulé (kJ/kg), la MMP à chaque durée testée sur le segment restant de
 * la sortie une fois ce palier franchi. `null` sans flux watts ou sans
 * poids athlète connu — le kJ/kg n'est pas calculable sans poids, jamais de
 * kJ bruts substitués silencieusement (voir kj-budget-unit-kj-per-kg dans
 * evidence/rules.ts).
 */
export function computeDurabilityProfile(
  watts: number[] | undefined,
  athleteWeightKg: number | null | undefined
): DurabilityTierProfile[] | null {
  if (!watts || watts.length === 0) return null
  if (!athleteWeightKg || athleteWeightKg <= 0) return null

  const cumulativeKJPerKg = computeAccumulatedWorkKJ(watts).map((kj) => kj / athleteWeightKg)
  const tiers = durabilityTiersKJPerKg()

  return tiers.map((tierKJPerKg) => {
    const reachedAtSampleIndex = cumulativeKJPerKg.findIndex((kj) => kj >= tierKJPerKg)
    const mmpByDurationSeconds: DurabilityTierProfile['mmpByDurationSeconds'] = {}

    if (reachedAtSampleIndex === -1) {
      for (const d of DURABILITY_TEST_DURATIONS_SECONDS) mmpByDurationSeconds[d] = null
      return { tierKJPerKg, reachedAtSampleIndex: null, mmpByDurationSeconds }
    }

    const segment = watts.slice(reachedAtSampleIndex)
    for (const d of DURABILITY_TEST_DURATIONS_SECONDS) {
      mmpByDurationSeconds[d] = maxMeanPower(segment, d)
    }
    return { tierKJPerKg, reachedAtSampleIndex, mmpByDurationSeconds }
  })
}

export interface DurabilityComparison {
  tierKJPerKg: number
  durationSeconds: (typeof DURABILITY_TEST_DURATIONS_SECONDS)[number]
  currentWatts: number | null
  /** Meilleure valeur historique de l'athlète à CE MÊME palier et CETTE MÊME durée — jamais une comparaison à un seuil labo ou à un autre athlète. */
  historicalBestWatts: number | null
  /** % d'écart current vs historicalBest — positif = mieux que l'historique. `null` si l'une des deux valeurs manque. */
  deltaPct: number | null
}

/**
 * Compare le profil de durabilité d'une sortie à l'historique de
 * l'athlète — palier par palier, durée par durée, jamais mélangé (seule
 * lecture valide selon ride-analysis-2-power-profile-by-accumulated-tier).
 * `historicalProfiles` : profils déjà calculés (computeDurabilityProfile)
 * de sorties passées comparables ; ne retient, par palier/durée, que la
 * meilleure valeur historique disponible.
 */
export function compareDurabilityToHistory(
  current: DurabilityTierProfile[],
  historicalProfiles: DurabilityTierProfile[][]
): DurabilityComparison[] {
  const comparisons: DurabilityComparison[] = []

  for (const currentTier of current) {
    for (const durationSeconds of DURABILITY_TEST_DURATIONS_SECONDS) {
      const currentWatts = currentTier.mmpByDurationSeconds[durationSeconds] ?? null

      let historicalBestWatts: number | null = null
      for (const pastProfile of historicalProfiles) {
        const pastTier = pastProfile.find((t) => t.tierKJPerKg === currentTier.tierKJPerKg)
        const pastWatts = pastTier?.mmpByDurationSeconds[durationSeconds] ?? null
        if (pastWatts != null && (historicalBestWatts == null || pastWatts > historicalBestWatts)) {
          historicalBestWatts = pastWatts
        }
      }

      const deltaPct =
        currentWatts != null && historicalBestWatts != null && historicalBestWatts !== 0
          ? ((currentWatts - historicalBestWatts) / historicalBestWatts) * 100
          : null

      comparisons.push({ tierKJPerKg: currentTier.tierKJPerKg, durationSeconds, currentWatts, historicalBestWatts, deltaPct })
    }
  }

  return comparisons
}
