// ── Verdict/confidence/trend composition for <ReadinessStrip> ───────────
//
// Restructuration complète (lifecycle-ui-reference.html, voir CLAUDE.md) —
// chaque cellule porte un point de confiance good/warn/bad/unknown (ce
// fichier ne réévalue AUCUN signal, il reclasse des classifications déjà
// en place — tsbZone, les seuils readiness déjà affichés sur /lifestyle,
// sleepQualityBand — dans ce vocabulaire à 4 valeurs) et une légende de
// tendance TEXTE (pas une sparkline — voir ci-dessous pourquoi ce choix a
// changé depuis la première version de ce fichier). Jamais vert par
// défaut : une valeur absente retourne toujours 'unknown'.
//
// ⚠️ Remplace les sparklines de la version précédente de ce fichier (voir
// CLAUDE.md "Refonte UI/IA... étape 3") : la référence HTML affinée
// affiche une LÉGENDE TEXTE sous chaque valeur ("CTL 48 · ATL 44",
// "↓ 8 vs moy. 7 j", "Qualité 87 %", "Dans ta norme") plutôt qu'un mini
// graphique — plus lisible qu'un tracé de 44×12px, et réutilise des
// nombres déjà calculés ailleurs dans l'app plutôt qu'une normalisation
// min/max. sparklinePoints() est donc supprimée (plus aucun appelant).

import { tsbZone } from './tsb-zones'
import { sleepQualityBand } from '@/components/lifestyle/lifestyle-types'
import { averageOrNull, windowedTrendSignal, type DatedValue } from './governor-types'

export type Confidence = 'good' | 'warn' | 'bad' | 'unknown' | 'neutral'

/**
 * Reclasse les 5 zones TSB (tsb-zones.ts, déjà la seule classification TSB
 * de l'app) en 3 paliers de confiance : favorable (optimal/fresh),
 * vigilance (zone grise — entraînement normal, et transition — trop frais,
 * perte de fitness si ça dure), risque (high-risk — fatigue très élevée).
 */
export function tsbConfidence(tsb: number | null | undefined): Confidence {
  if (tsb == null || isNaN(tsb)) return 'unknown'
  const zone = tsbZone(tsb).id
  if (zone === 'optimal' || zone === 'fresh') return 'good'
  if (zone === 'high-risk') return 'bad'
  return 'warn' // grey | transition
}

/** Mêmes seuils que le sublabel déjà affiché sur /lifestyle (readiness > 75/50) — pas une deuxième échelle. */
export function readinessConfidence(readiness: number | null | undefined): Confidence {
  if (readiness == null || isNaN(readiness)) return 'unknown'
  if (readiness > 75) return 'good'
  if (readiness > 50) return 'warn'
  return 'bad'
}

/** Mêmes bandes qu'ailleurs dans l'app (sleepQualityBand) — great/good -> good, average -> warn, poor -> bad. */
export function sleepConfidence(sleepQuality: number | null | undefined): Confidence {
  if (sleepQuality == null || isNaN(sleepQuality)) return 'unknown'
  const band = sleepQualityBand(sleepQuality)
  if (band === 'poor') return 'bad'
  if (band === 'average') return 'warn'
  return 'good'
}

/**
 * HRV/FC repos partagent une cellule — jamais un dot good/bad pour le HRV
 * lui-même : son signe reste ambigu en soi (principle-3-hrv-sign-ambiguous,
 * `forbidden-hrv-sign-fatigue-freshness`, evidence/rules.ts — déjà la raison
 * pour laquelle la tuile HRV n'a jamais de LED jour/veille, voir
 * performance-bento.tsx). Ce point reste donc toujours 'neutral' (présence
 * de donnée) ou 'unknown' (absence totale) — jamais une lecture favorable/
 * défavorable, contrairement aux 3 autres cellules.
 */
export function vitalsConfidence(hrv: number | null | undefined, restingHR: number | null | undefined): Confidence {
  if (hrv == null && restingHR == null) return 'unknown'
  return 'neutral'
}

export interface ReadinessVerdict {
  confidence: Confidence
  title: string
  sentence: string
}

function worseConfidence(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = { bad: 0, warn: 1, neutral: 1, good: 2, unknown: 3 }
  if (a === 'unknown') return b
  if (b === 'unknown') return a
  return rank[a] <= rank[b] ? a : b
}

// Reprend mot pour mot le texte déjà affiché sur /lifestyle pour ces mêmes
// seuils (readiness > 75/50) — une seule formulation, pas une deuxième.
function readinessSentence(readiness: number | null): string | null {
  if (readiness == null) return null
  if (readiness > 75) return 'Prêt pour l\'effort'
  if (readiness > 50) return 'Effort modéré conseillé'
  return 'Privilégiez la récupération'
}

/**
 * Verdict composite de la cellule "Aujourd'hui" — compose un titre/une
 * phrase à partir des DEUX classifications déjà fiables (TSB, readiness),
 * jamais un troisième score inventé pour l'occasion (même discipline que le
 * refus du "JOIN Level", voir CLAUDE.md "Audit Join Cycling").
 */
export function buildReadinessVerdict(tsb: number | null | undefined, readiness: number | null | undefined): ReadinessVerdict {
  const tsbC = tsbConfidence(tsb)
  const readinessC = readinessConfidence(readiness)
  if (tsbC === 'unknown' && readinessC === 'unknown') {
    return {
      confidence: 'unknown',
      title: 'Pas encore de données',
      sentence: 'Connectez Intervals.icu ou renseignez vos métriques pour voir votre verdict du jour.',
    }
  }
  const confidence = worseConfidence(tsbC, readinessC)
  const zoneLabel = tsb != null && !isNaN(tsb) ? tsbZone(tsb).label : null
  const detailParts: string[] = []
  if (zoneLabel) detailParts.push(`TSB en ${zoneLabel.toLowerCase()}`)
  const rSentence = readinessSentence(readiness ?? null)
  if (rSentence) detailParts.push(rSentence.toLowerCase())
  const title = confidence === 'good' ? 'Prêt à performer' : confidence === 'bad' ? 'Récupération prioritaire' : 'Vigilance'
  const sentence = detailParts.length > 0 ? detailParts.join(', ') + '.' : title + '.'
  return { confidence, title, sentence }
}

// ── Légendes de tendance (texte, pas une sparkline — voir le commentaire
// de tête du fichier) ────────────────────────────────────────────────────

/** "CTL 48 · ATL 44" — purement informatif, jamais un delta/jugement (CTL/ATL n'ont pas de "mieux/moins bien" simple au jour le jour). */
export function formeTrendCaption(ctl: number | null | undefined, atl: number | null | undefined): string | null {
  const parts: string[] = []
  if (ctl != null && !isNaN(ctl)) parts.push(`CTL ${Math.round(ctl)}`)
  if (atl != null && !isNaN(atl)) parts.push(`ATL ${Math.round(atl)}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * "↓ 8 vs moy. 6 j" — delta du jour vs la moyenne des jours PRÉCÉDENTS
 * disponibles dans `history` (jamais figé à "7 j" si moins de jours
 * existent réellement — le nombre affiché est toujours celui des points
 * utilisés). `null` si `history` ne contient pas le jour `todayIso` ou
 * aucun jour antérieur à comparer.
 */
export function windowAverageTrendCaption(history: DatedValue[], todayIso: string, maxPriorDays = 7): string | null {
  const todayEntry = history.find((d) => d.date === todayIso)
  if (!todayEntry) return null
  const prior = history
    .filter((d) => d.date < todayIso)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxPriorDays)
  if (prior.length === 0) return null
  const avg = averageOrNull(prior.map((d) => d.value))
  if (avg == null) return null
  const delta = Math.round(todayEntry.value - avg)
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '='
  return `${arrow} ${Math.abs(delta)} vs moy. ${prior.length} j`
}

/** "Qualité 87 %" — déjà une donnée directe, aucun calcul. */
export function sleepTrendCaption(sleepQuality: number | null | undefined): string | null {
  if (sleepQuality == null || isNaN(sleepQuality)) return null
  return `Qualité ${Math.round(sleepQuality)} %`
}

/**
 * "Dans ta norme" / "Écart vs ta ligne de base" — jamais une lecture
 * HRV isolée (voir vitalsConfidence ci-dessus) : ne parle QUE si les DEUX
 * signaux (HRV tendance favorable='higher', FC repos tendance
 * favorable='lower' — même windowedTrendSignal déjà utilisé par le
 * gouverneur de charge interne, pas un deuxième calcul) ont assez
 * d'historique pour se prononcer (≥7j récents + ≥28j de ligne de base
 * chacun) ; `null` (jamais une affirmation à moitié informée) si l'un des
 * deux manque de recul. Jamais "HRV en baisse" ou "FC repos élevée"
 * isolément — toujours la paire, jamais un verdict good/bad.
 */
export function vitalsTrendCaption(hrvHistory: DatedValue[], restingHrHistory: DatedValue[], todayIso: string): string | null {
  const hrvSignal = windowedTrendSignal(hrvHistory, todayIso, 'higher')
  const rhrSignal = windowedTrendSignal(restingHrHistory, todayIso, 'lower')
  if (hrvSignal == null || rhrSignal == null) return null
  return hrvSignal >= 0 && rhrSignal >= 0 ? 'Dans ta norme' : 'Écart vs ta ligne de base'
}
