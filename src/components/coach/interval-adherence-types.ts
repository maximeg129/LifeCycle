// ── Réalisé vs prévu — respect des intervalles d'une séance ──────────────
//
// Retour utilisateur : "quand on fait l'analyse des activités, que le coach
// fasse l'analyse de l'activité par rapport à l'activité prévue... est-ce
// que les intervalles sont bien respectés... il en découle soit des
// propositions du coach d'ajustement ou du questionnement par rapport à
// est-ce qu'on doit ajuster le plan."
//
// ⚠️ Méthode, et sa limite honnête : Intervals.icu ne renvoie pas de repères
// de tour/intervalle vérifiés pour une séance donnée (contrairement à leur
// propre détection auto-intervalles, une fonctionnalité distincte, non
// câblée ici — voir le commentaire sur le réseau bloqué ailleurs dans
// CLAUDE.md, aucun moyen de vérifier la forme exacte de cet endpoint depuis
// ce sandbox). Ce module découpe donc le flux watts RÉEL déjà fetché pour
// rideAnalysis (voir ride-analysis-types.ts) séquentiellement, selon les
// DURÉES du script prévu (parseStructuredWorkoutProfile,
// plan-calendar-types.ts) — un cumul d'offsets, pas des tours détectés. Si
// l'athlète a dérivé du minutage prévu (parti plus tard sur un effort, pris
// plus de repos qu'annoncé...), les tranches glissent et le rapprochement
// devient trompeur plutôt que juste imprécis. `computeIntervalAdherence`
// refuse donc de produire un résultat si la durée réelle totale (longueur du
// flux) s'écarte de plus de `DURATION_MISMATCH_TOLERANCE` de la durée
// prévue totale — `null` (aucun encart, aucune ligne de prompt) plutôt qu'un
// découpage qui mentirait sur quel effort a produit quels watts.

import type { WorkoutProfileStep } from '@/components/cycling/plan-calendar-types'

const DURATION_MISMATCH_TOLERANCE = 0.25 // ±25%

export type IntervalAdherenceVerdict = 'below' | 'within' | 'above'

export interface IntervalAdherenceStep {
  /** 0-based, dans l'ordre du script prévu. */
  index: number
  targetDurationSeconds: number
  targetPctLow: number
  targetPctHigh: number
  actualAvgWatts: number
  /** Puissance réelle moyenne de la tranche, en %FTP — comparée à [targetPctLow, targetPctHigh]. */
  actualPctFtp: number
  verdict: IntervalAdherenceVerdict
}

export interface IntervalAdherenceResult {
  steps: IntervalAdherenceStep[]
  withinCount: number
  belowCount: number
  aboveCount: number
}

/**
 * Découpe `watts` (flux seconde-par-seconde réel) selon les durées de
 * `plannedSteps` (dans l'ordre), calcule la puissance moyenne réelle de
 * chaque tranche en %FTP et la compare à la fourchette cible de l'étape
 * correspondante. `null` — jamais un résultat partiel/trompeur — si :
 * pas de flux watts, pas de FTP connu, aucune étape planifiée, ou durée
 * réelle totale trop éloignée de la durée prévue totale (voir le
 * commentaire de fichier). Une étape dont `pctFtpLow`/`pctFtpHigh` est
 * absent (step construit à la main ailleurs que par
 * parseStructuredWorkoutProfile) retombe sur `pctFtp` pour les deux bornes.
 */
export function computeIntervalAdherence(
  watts: number[] | undefined,
  plannedSteps: WorkoutProfileStep[],
  ftp: number | null | undefined
): IntervalAdherenceResult | null {
  if (!watts || watts.length === 0) return null
  if (!ftp || ftp <= 0) return null
  if (plannedSteps.length === 0) return null

  const plannedTotalSeconds = plannedSteps.reduce((sum, s) => sum + s.durationSeconds, 0)
  if (plannedTotalSeconds <= 0) return null

  const actualTotalSeconds = watts.length
  const lowerBound = plannedTotalSeconds * (1 - DURATION_MISMATCH_TOLERANCE)
  const upperBound = plannedTotalSeconds * (1 + DURATION_MISMATCH_TOLERANCE)
  if (actualTotalSeconds < lowerBound || actualTotalSeconds > upperBound) return null

  const steps: IntervalAdherenceStep[] = []
  let withinCount = 0
  let belowCount = 0
  let aboveCount = 0
  let cursor = 0

  plannedSteps.forEach((planned, index) => {
    const slice = watts.slice(cursor, cursor + planned.durationSeconds)
    cursor += planned.durationSeconds
    if (slice.length === 0) return

    const actualAvgWatts = slice.reduce((sum, w) => sum + w, 0) / slice.length
    const actualPctFtp = (actualAvgWatts / ftp) * 100
    const targetPctLow = planned.pctFtpLow ?? planned.pctFtp
    const targetPctHigh = planned.pctFtpHigh ?? planned.pctFtp

    const verdict: IntervalAdherenceVerdict =
      actualPctFtp < targetPctLow ? 'below' : actualPctFtp > targetPctHigh ? 'above' : 'within'
    if (verdict === 'within') withinCount++
    else if (verdict === 'below') belowCount++
    else aboveCount++

    steps.push({
      index,
      targetDurationSeconds: planned.durationSeconds,
      targetPctLow,
      targetPctHigh,
      actualAvgWatts: Math.round(actualAvgWatts),
      actualPctFtp: Math.round(actualPctFtp),
      verdict,
    })
  })

  if (steps.length === 0) return null
  return { steps, withinCount, belowCount, aboveCount }
}
