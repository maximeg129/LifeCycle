// ── Sélection des records de puissance depuis la courbe Intervals.icu ─────
//
// Le fit Riegel lui-même (P = a·t^(−e), TTE, indice d'endurance) vit
// désormais dans domain/cycling/metrics/endurance.ts (PR 6/11d) — évidence-
// based, adossé à R12/R13, avec le domaine de validité (~3,5-230min, R12)
// que ce fichier n'avait jamais. Ne reste ici que la sélection des 3
// records depuis la vraie courbe de puissance Intervals.icu (secs/values),
// une préoccupation UI (quels boutons "Court/Moyen/Long" afficher) sans
// lien avec le modèle physiologique lui-même.

export interface PowerRecord {
  seconds: number
  watts: number
}

// Target durations the fit needs one record near, matching the UI's own
// labels ("Court 3-7min", "Moyen ~20min", "Long >60min") — used to pick the
// closest bucket out of Intervals.icu's real mean-max-power curve (see
// pickPowerRecordsFromCurve below), which auto-fills what used to require
// typing 3 personal records by hand.
const SHORT_TARGET_SECONDS = 5 * 60
const MEDIUM_TARGET_SECONDS = 20 * 60
const LONG_TARGET_SECONDS = 90 * 60

export interface PickedPowerRecords {
  shortRecord: PowerRecord | null
  mediumRecord: PowerRecord | null
  longRecord: PowerRecord | null
}

/**
 * Picks the short/medium/long power records this app's Riegel fit needs out
 * of a raw mean-max-power curve (Intervals.icu's `secs`/`values` parallel
 * arrays — real best-power-ever-held-for-that-long data, not a manual
 * entry). For each target duration, takes the single closest available
 * bucket rather than assuming any particular bucket granularity — Intervals.icu's
 * own curve resolution isn't part of this app's contract with it.
 */
export function pickPowerRecordsFromCurve(secs: number[], values: number[]): PickedPowerRecords {
  const nearest = (targetSeconds: number): PowerRecord | null => {
    if (secs.length === 0) return null
    let bestIndex = 0
    let bestDiff = Infinity
    for (let i = 0; i < secs.length; i++) {
      const diff = Math.abs(secs[i] - targetSeconds)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIndex = i
      }
    }
    const watts = values[bestIndex]
    if (watts == null || watts <= 0) return null
    return { seconds: secs[bestIndex], watts }
  }

  return {
    shortRecord: nearest(SHORT_TARGET_SECONDS),
    mediumRecord: nearest(MEDIUM_TARGET_SECONDS),
    longRecord: nearest(LONG_TARGET_SECONDS),
  }
}
