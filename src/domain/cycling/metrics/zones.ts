// ── Zones — double modèle obligatoire (section 3.4) ────────────────────────
//
// "Double modèle de zones obligatoire : 3 zones (pour la distribution
// d'intensité, R18) et 5–7 zones (pour la prescription)."
//
// Les 7 zones de puissance ci-dessous viennent de l'algorithme Coggan (R16
// — propriétaire, non revu par les pairs, à étiqueter comme tel en UI,
// voir la règle power-np-if-tss-label-proprietary dans evidence/rules.ts).
// R18 (Seiler) définit ses 3 zones de distribution par seuil de lactate
// sanguin (~2mM) — une mesure qu'aucun flux watts seul ne peut reproduire.
// Plutôt que d'inventer un nouveau seuil %FTP pour approximer ce seuil
// lactate (exactement le genre de constante non sourcée que ce projet
// s'interdit), le modèle 3 zones regroupe les 7 zones déjà sourcées R16 —
// une décision de construction, pas une nouvelle affirmation scientifique.
// Signalée explicitement à l'utilisateur (docs/OPEN_QUESTIONS.md, Q5)
// plutôt que tranchée en silence.

export interface PowerZoneDef {
  zone: number
  label: string
  minPct: number
  maxPct: number | null
}

/** 7 zones de puissance, % de la FTP — Coggan (R16). */
export const POWER_ZONES_7: PowerZoneDef[] = [
  { zone: 1, label: 'Récupération', minPct: 0, maxPct: 55 },
  { zone: 2, label: 'Endurance', minPct: 55, maxPct: 75 },
  { zone: 3, label: 'Tempo', minPct: 75, maxPct: 90 },
  { zone: 4, label: 'Seuil', minPct: 90, maxPct: 105 },
  { zone: 5, label: 'VO2max', minPct: 105, maxPct: 120 },
  { zone: 6, label: 'Anaérobie', minPct: 120, maxPct: 150 },
  { zone: 7, label: 'Neuromusculaire', minPct: 150, maxPct: null },
]

export type ThreeZoneId = 'zone1' | 'zone2' | 'zone3'

export interface ThreeZoneDef {
  id: ThreeZoneId
  label: string
  /** Zones Coggan (7 zones, R16) regroupées dans cette zone de distribution (R18). */
  cogganZones: number[]
}

export const POWER_ZONES_3: ThreeZoneDef[] = [
  { id: 'zone1', label: 'Basse intensité', cogganZones: [1, 2] },
  { id: 'zone2', label: 'Intensité modérée', cogganZones: [3, 4] },
  { id: 'zone3', label: 'Haute intensité', cogganZones: [5, 6, 7] },
]

export interface PowerZoneBucket {
  zone: number
  label: string
  seconds: number
}

/** Temps en zone (secondes/zone), modèle 7 zones (R16) — `null` sans flux watts ou sans FTP connue. */
export function computePowerZoneDistribution7(watts: number[] | undefined, ftp: number | null | undefined): PowerZoneBucket[] | null {
  if (!watts || watts.length === 0 || !ftp || ftp <= 0) return null
  const counts = POWER_ZONES_7.map(() => 0)
  for (const w of watts) {
    const pct = (w / ftp) * 100
    const idx = POWER_ZONES_7.findIndex((z) => pct >= z.minPct && (z.maxPct == null || pct < z.maxPct))
    if (idx >= 0) counts[idx] += 1
  }
  return POWER_ZONES_7.map((z, i) => ({ zone: z.zone, label: z.label, seconds: counts[i] }))
}

export interface ThreeZoneBucket {
  id: ThreeZoneId
  label: string
  seconds: number
}

/** Regroupe une distribution 7 zones en distribution 3 zones (R18) — voir le commentaire d'en-tête pour la justification du regroupement. */
export function to3ZoneDistribution(sevenZoneBuckets: PowerZoneBucket[]): ThreeZoneBucket[] {
  return POWER_ZONES_3.map((z3) => ({
    id: z3.id,
    label: z3.label,
    seconds: sevenZoneBuckets.filter((b) => z3.cogganZones.includes(b.zone)).reduce((sum, b) => sum + b.seconds, 0),
  }))
}

/**
 * % du temps total passé en zone 1 (basse intensité) — la cible descriptive
 * R18 est ~80%, mais c'est une observation d'athlètes très entraînés (10-13
 * séances/semaine), pas une prescription universelle (voir la règle
 * power-distribution-target-descriptive-not-prescriptive). `null` sans
 * aucune donnée de temps en zone.
 */
export function lowIntensityPct(threeZoneBuckets: ThreeZoneBucket[]): number | null {
  const total = threeZoneBuckets.reduce((sum, b) => sum + b.seconds, 0)
  if (total === 0) return null
  const zone1 = threeZoneBuckets.find((b) => b.id === 'zone1')?.seconds ?? 0
  return (zone1 / total) * 100
}
