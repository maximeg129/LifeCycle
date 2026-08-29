// ── TTE / endurance-index model (Riegel power law) — pure functions ───────
//
// Fits P(t) = a · t^(-e) to 3 personal power records via log-log linear
// regression, rather than assuming a critical-power "physiological ceiling"
// or fixed training zones. The endurance index (1 - e) is typically
// 0.85-0.95: closer to 1 means power holds up longer over duration. TTE at
// any target power is then the record-pace duration you could theoretically
// hold there — the real yardstick for how hard a session actually is.

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

export interface PowerCurve {
  a: number // P(1s) intercept of the fitted curve
  e: number // fatigue/decay exponent (smaller = better endurance)
  enduranceIndex: number // 1 - e, typically 0.85-0.95
}

/** Least-squares fit of P = a·t^(-e) via linear regression on log(P) vs log(t). Needs ≥2 valid records. */
export function fitPowerDurationCurve(records: PowerRecord[]): PowerCurve | null {
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
  if (denom === 0) return null // all durations identical, can't fit a slope

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const e = -slope
  if (e <= 0) return null // degenerate: power not decaying with duration

  return { a: Math.exp(intercept), e, enduranceIndex: 1 - e }
}

/** Theoretical time-to-exhaustion (seconds) at `targetWatts`, per the fitted curve. */
export function computeTTE(targetWatts: number, curve: PowerCurve): number | null {
  if (targetWatts <= 0 || curve.e <= 0) return null
  return Math.pow(curve.a / targetWatts, 1 / curve.e)
}

/**
 * How hard a session actually was, relative to the record-pace TTE at that
 * power — close to 1 means it was run near the physiological limit for that
 * duration (high RPE), regardless of the absolute wattage or a fixed zone.
 */
export function difficultyRatio(sessionSeconds: number, sessionWatts: number, curve: PowerCurve): number | null {
  const tte = computeTTE(sessionWatts, curve)
  if (tte == null || tte <= 0) return null
  return sessionSeconds / tte
}
