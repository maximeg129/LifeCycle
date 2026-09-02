// ── Pure stream-crunching for the "Analyse complète de la sortie" feature ──
//
// Kept separate from ride-analysis-flow.ts ('use server') per the hard
// lesson in CLAUDE.md ("un fichier 'use server' ne peut exporter QUE des
// fonctions async") — these are plain runtime functions (not async, not
// flows), and none of them may live in the flow file itself. Turns a raw
// Intervals.icu activity stream (per-second watts/heartrate arrays) into
// the handful of real numbers the AI flow's prompt is built from —
// normalized power, power/HR zone time, pacing — so Claude analyzes actual
// data rather than guessing from a name and a duration.

export interface PowerZoneBucket {
  zone: number
  label: string
  minPct: number
  maxPct: number | null
  seconds: number
}

export interface HrZoneBucket {
  zone: number
  label: string
  minPct: number
  maxPct: number | null
  seconds: number
}

export interface SplitAnalysis {
  firstHalfAvgWatts: number
  secondHalfAvgWatts: number
  /** 'negative' = went harder in the 2nd half (classic "negative split", good pacing), 'positive' = faded, 'even' = within 5%. */
  fade: 'negative' | 'positive' | 'even'
  /** (first - second) / first * 100 — positive means the athlete faded. */
  fadePct: number
}

// Exportée (plutôt que privée à ce fichier) pour que plan-calendar-types.ts
// puisse classer une intensité (%FTP réel ou cible) dans la même échelle de
// zones sans dupliquer les bornes — un seul référentiel Coggan pour toute
// l'app plutôt que deux tables qui pourraient diverger.
export const POWER_ZONES = [
  { zone: 1, label: 'Récupération', minPct: 0, maxPct: 55 },
  { zone: 2, label: 'Endurance', minPct: 55, maxPct: 75 },
  { zone: 3, label: 'Tempo', minPct: 75, maxPct: 90 },
  { zone: 4, label: 'Seuil', minPct: 90, maxPct: 105 },
  { zone: 5, label: 'VO2max', minPct: 105, maxPct: 120 },
  { zone: 6, label: 'Anaérobie', minPct: 120, maxPct: 150 },
  { zone: 7, label: 'Neuromusculaire', minPct: 150, maxPct: null as number | null },
]

const HR_ZONES = [
  { zone: 1, label: 'Récupération', minPct: 0, maxPct: 60 },
  { zone: 2, label: 'Endurance', minPct: 60, maxPct: 70 },
  { zone: 3, label: 'Tempo', minPct: 70, maxPct: 80 },
  { zone: 4, label: 'Seuil', minPct: 80, maxPct: 90 },
  { zone: 5, label: 'VO2max', minPct: 90, maxPct: null as number | null },
]

/** Mean of finite values, ignoring gaps/NaN in the stream. Null if nothing valid. */
export function average(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Normalized Power (Coggan's algorithm): a 30-sample rolling average of the
 * power series, each value raised to the 4th power, averaged, then the 4th
 * root taken. Assumes ~1Hz samples — Intervals.icu's default stream
 * resolution — so the window covers ~30 real seconds; a coarser stream just
 * widens the effective window, which only skews short/spiky efforts.
 * Returns null for streams too short to computed a meaningful 30s window.
 */
export function computeNormalizedPower(watts: number[]): number | null {
  const valid = watts.filter((w) => Number.isFinite(w) && w >= 0)
  if (valid.length < 30) return null
  const rolling: number[] = []
  let windowSum = 0
  for (let i = 0; i < valid.length; i++) {
    windowSum += valid[i]
    if (i >= 30) windowSum -= valid[i - 30]
    if (i >= 29) rolling.push(windowSum / 30)
  }
  if (rolling.length === 0) return null
  const meanFourth = rolling.reduce((sum, w) => sum + w ** 4, 0) / rolling.length
  return Math.round(meanFourth ** 0.25)
}

function bucketSeconds<Z extends { zone: number; label: string; minPct: number; maxPct: number | null }>(
  series: number[],
  zones: Z[],
  reference: number
): (Z & { seconds: number })[] {
  const counts = zones.map(() => 0)
  for (const v of series) {
    if (!Number.isFinite(v) || v < 0) continue
    const pct = (v / reference) * 100
    const idx = zones.findIndex((z) => pct >= z.minPct && (z.maxPct == null || pct < z.maxPct))
    if (idx >= 0) counts[idx]++
  }
  return zones.map((z, i) => ({ ...z, seconds: counts[i] }))
}

/** Time-in-zone distribution (seconds/zone), Coggan 7-zone model relative to FTP. Null without a watts stream or a known FTP. */
export function computePowerZoneDistribution(watts: number[] | undefined, ftp: number | null | undefined): PowerZoneBucket[] | null {
  if (!watts || watts.length === 0 || !ftp || ftp <= 0) return null
  return bucketSeconds(watts, POWER_ZONES, ftp)
}

/** Time-in-zone distribution (seconds/zone), 5-zone model relative to max HR (this ride's own max_heartrate — see use-ride-analysis.ts for why no separate physiological max is needed). Null without a heartrate stream or a known max HR. */
export function computeHrZoneDistribution(heartrate: number[] | undefined, maxHr: number | null | undefined): HrZoneBucket[] | null {
  if (!heartrate || heartrate.length === 0 || !maxHr || maxHr <= 0) return null
  return bucketSeconds(heartrate, HR_ZONES, maxHr)
}

/** Compares average power in the first vs second half of the ride — a simple pacing/fade signal. Null for streams too short to split meaningfully. */
export function computeSplitAnalysis(watts: number[] | undefined): SplitAnalysis | null {
  if (!watts || watts.length < 60) return null
  const mid = Math.floor(watts.length / 2)
  const first = average(watts.slice(0, mid))
  const second = average(watts.slice(mid))
  if (first == null || second == null || first <= 0) return null
  const fadePct = ((first - second) / first) * 100
  const fade = fadePct > 5 ? 'positive' : fadePct < -5 ? 'negative' : 'even'
  return {
    firstHalfAvgWatts: Math.round(first),
    secondHalfAvgWatts: Math.round(second),
    fade,
    fadePct: Math.round(fadePct * 10) / 10,
  }
}
