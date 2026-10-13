// ── Verdict/confidence composition for <ReadinessStrip> ─────────────────
//
// Refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md §3.3/§5, "Aujourd'hui" —
// ReadinessStrip remplace les 3 anneaux Forme/Récupération/Sommeil) : chaque
// cellule porte un point de confiance good/warn/bad/unknown — ce fichier ne
// réévalue AUCUN signal, il reclasse des classifications déjà en place
// (tsbZone, les seuils readiness déjà affichés sur /lifestyle, sleepQualityBand)
// dans ce vocabulaire à 4 valeurs plutôt que d'inventer une nouvelle échelle.
// Jamais vert par défaut : une valeur absente retourne toujours 'unknown'.

import { tsbZone } from './tsb-zones'
import { sleepQualityBand } from '@/components/lifestyle/lifestyle-types'

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

/**
 * Coordonnées SVG `points` pour une mini sparkline (12px de haut, voir le
 * brief UI §4.2) à partir d'une série de valeurs déjà disponibles (aucune
 * agrégation statistique — juste une normalisation min/max pour le tracé).
 * `null` (jamais une ligne plate inventée) si moins de 2 valeurs réelles —
 * rien à tracer. Toutes les valeurs égales (ligne plate réelle) se trace au
 * milieu de la hauteur plutôt que de diviser par zéro.
 */
export function sparklinePoints(values: number[], width: number, height: number): string | null {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const step = width / (values.length - 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = range === 0 ? height / 2 : height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
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
