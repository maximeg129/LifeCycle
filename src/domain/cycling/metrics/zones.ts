// ── Zones — double modèle obligatoire (section 3.4) ────────────────────────
//
// "Double modèle de zones obligatoire : 3 zones (pour la distribution
// d'intensité, R18) et 5–7 zones (pour la prescription)."
//
// Les 7 zones de puissance ci-dessous viennent de l'algorithme Coggan (R16
// — propriétaire, non revu par les pairs, à étiqueter comme tel en UI, voir
// la règle power-np-if-tss-label-proprietary dans evidence/rules.ts).
// Corroborées par une source supplémentaire fournie par l'utilisateur
// (evidence/supplementary-sources.ts, S01) — mêmes bornes, aucun changement
// nécessaire.
//
// R18 (Seiler, dans les 35 références) établit la cible ~80% basse
// intensité mais définit ses 3 zones de distribution par seuil de lactate
// sanguin (~2mM), une mesure qu'aucun flux watts seul ne peut reproduire —
// il ne donne donc aucune borne %FTP exploitable ici. Les bornes ci-dessous
// viennent d'une deuxième source fournie par l'utilisateur en cours de
// projet (evidence/supplementary-sources.ts, S02 — diapositive attribuée à
// Seiler, niveau [C], pas une publication de Seiler lui-même) qui se
// contredisait entre son tableau (60/80/100) et son texte (50/80/100) ;
// décision utilisateur du 31 août 2026 (docs/OPEN_QUESTIONS.md, Q5) :
// retenir les valeurs du texte. Zone 1 n'a pas de plancher explicite dans
// la source (le texte dit "50-79%" sans dire ce qui se passe en dessous) —
// le plancher est fixé à 0 ici pour que le temps en zone reste complet
// (aucune donnée silencieusement perdue en dessous de 50%), un choix
// d'implémentation documenté, pas une valeur sourcée.

export interface PowerZoneDef {
  zone: number
  label: string
  minPct: number
  maxPct: number | null
}

/** 7 zones de puissance, % de la FTP — Coggan (R16), corroboré par S01. */
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
  minPct: number
  maxPct: number | null
}

/** 3 zones de distribution d'intensité, % de la FTP — Seiler (R18 pour le principe, S02 pour les bornes numériques). */
export const POWER_ZONES_3: ThreeZoneDef[] = [
  { id: 'zone1', label: 'Basse intensité', minPct: 0, maxPct: 80 },
  { id: 'zone2', label: 'Intensité modérée', minPct: 80, maxPct: 100 },
  { id: 'zone3', label: 'Haute intensité', minPct: 100, maxPct: null },
]

function bucketSeconds<Z extends { minPct: number; maxPct: number | null }>(
  watts: number[],
  ftp: number,
  zones: Z[]
): number[] {
  const counts = zones.map(() => 0)
  for (const w of watts) {
    const pct = (w / ftp) * 100
    const idx = zones.findIndex((z) => pct >= z.minPct && (z.maxPct == null || pct < z.maxPct))
    if (idx >= 0) counts[idx] += 1
  }
  return counts
}

export interface PowerZoneBucket {
  zone: number
  label: string
  seconds: number
}

/** Temps en zone (secondes/zone), modèle 7 zones (R16) — `null` sans flux watts ou sans FTP connue. */
export function computePowerZoneDistribution7(watts: number[] | undefined, ftp: number | null | undefined): PowerZoneBucket[] | null {
  if (!watts || watts.length === 0 || !ftp || ftp <= 0) return null
  const counts = bucketSeconds(watts, ftp, POWER_ZONES_7)
  return POWER_ZONES_7.map((z, i) => ({ zone: z.zone, label: z.label, seconds: counts[i] }))
}

export interface ThreeZoneBucket {
  id: ThreeZoneId
  label: string
  seconds: number
}

/** Temps en zone (secondes/zone), modèle 3 zones (R18/S02) — `null` sans flux watts ou sans FTP connue. */
export function computePowerZoneDistribution3(watts: number[] | undefined, ftp: number | null | undefined): ThreeZoneBucket[] | null {
  if (!watts || watts.length === 0 || !ftp || ftp <= 0) return null
  const counts = bucketSeconds(watts, ftp, POWER_ZONES_3)
  return POWER_ZONES_3.map((z, i) => ({ id: z.id, label: z.label, seconds: counts[i] }))
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
