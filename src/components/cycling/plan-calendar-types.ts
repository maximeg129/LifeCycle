// ── Vue calendrier du plan d'entraînement — logique pure ────────────────
//
// Retour utilisateur, capture d'écran (export PDF de l'app) à l'appui :
// "c'est pas idéal encore des long scroll beaucoup d'info et on peut se
// perdre, et si on faisait une calendar view? un peu à l'exemple de
// intervals... en donnant un visual de l'activité (avec zone de
// puissance/couleurs) etc pour que l'athlète sache ce qu'il a à faire."
// Remplace la longue liste verticale de cartes-semaine (12 semaines
// empilées, chacune développable) par une vue calendrier : une grille
// compacte du plan entier pour l'orientation + une vue semaine détaillée,
// chaque jour coloré selon l'intensité de sa séance.
//
// ⚠️ Décision consciente sur la source des couleurs : les vraies zones de
// puissance seconde-par-seconde (computePowerZoneDistribution,
// ride-analysis-types.ts) exigent le flux détaillé d'UNE activité — un
// fetch réseau à part entière (voir /api/intervals/activities/[id]),
// coûteux à répéter pour chaque jour d'un calendrier de plusieurs semaines.
// Cette vue reste donc sur des données déjà chargées en masse (liste
// d'activités, sans flux) : `icu_intensity` (Intensity Factor déjà calculé
// par Intervals.icu = NP/FTP) pour une sortie RÉALISÉE, ou le script
// structuré déjà généré par l'IA pour une séance PLANIFIÉE — jamais un flux
// re-téléchargé pour l'occasion. Le détail par seconde reste consultable en
// ouvrant la sortie (RideAnalysisDialog, déjà existant), pas dupliqué ici.

import { POWER_ZONES } from '@/components/coach/ride-analysis-types'
import { bestAverageWatts, type PowerFieldsLike, type IntervalsActivity } from '@/lib/intervals-api'
import type { PlanWeekSessionWithValidation, SessionCompletion } from './training-plan-types'

export interface WorkoutProfileStep {
  durationSeconds: number
  /** Milieu de la fourchette cible %FTP de cette étape (ex. "95-105%" → 100). */
  pctFtp: number
}

const STEP_LINE_RE = /^-\s*(\d+(?:\.\d+)?)\s*(s|m|h)\b.*?(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*%/i
const SECTION_REPEAT_RE = /(\d+)\s*x\s*$/i

function toSeconds(value: number, unit: string): number {
  const u = unit.toLowerCase()
  if (u === 'h') return value * 3600
  if (u === 'm') return value * 60
  return value
}

/**
 * Parse un script au format "workout builder" Intervals.icu (voir
 * STRUCTURED_WORKOUT_SYNTAX, structured-workout-syntax.ts) en une liste
 * plate d'étapes avec leur cible %FTP — pour dessiner une petite barre de
 * profil d'intensité par séance planifiée (plan-week-calendar.tsx). Ne
 * lève jamais d'exception : une ligne/section illisible (ex. une cible en
 * watts absolus plutôt qu'en %, cas rare documenté dans le prompt IA) est
 * simplement ignorée plutôt que de faire échouer tout le rendu du
 * calendrier — le script original envoyé à Intervals.icu reste la seule
 * source de vérité, ceci n'est qu'un aperçu visuel dégradable.
 */
export function parseStructuredWorkoutProfile(script: string | undefined | null): WorkoutProfileStep[] {
  if (!script) return []
  const steps: WorkoutProfileStep[] = []
  const sections = script.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
  for (const section of sections) {
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue
    const repeatMatch = lines[0].match(SECTION_REPEAT_RE)
    const repeatCount = repeatMatch ? Math.max(1, Number(repeatMatch[1])) : 1
    const blockSteps: WorkoutProfileStep[] = []
    for (const line of lines.slice(1)) {
      if (!line.startsWith('-')) continue
      const m = line.match(STEP_LINE_RE)
      if (!m) continue
      const durationSeconds = toSeconds(Number(m[1]), m[2])
      const lo = Number(m[3])
      const hi = m[4] != null ? Number(m[4]) : lo
      blockSteps.push({ durationSeconds, pctFtp: (lo + hi) / 2 })
    }
    for (let i = 0; i < repeatCount; i++) steps.push(...blockSteps)
  }
  return steps
}

/** Intensité moyenne (%FTP), pondérée par la durée de chaque étape — pour un badge/pastille à une seule couleur quand la place manque pour la barre de profil complète. Null pour une liste vide (jamais 0, qui laisserait croire à une séance de récupération). */
export function averageIntensityPct(steps: WorkoutProfileStep[]): number | null {
  const totalDuration = steps.reduce((sum, s) => sum + s.durationSeconds, 0)
  if (totalDuration === 0) return null
  const weighted = steps.reduce((sum, s) => sum + s.durationSeconds * s.pctFtp, 0)
  return weighted / totalDuration
}

/**
 * Une couleur réelle par zone Coggan (jamais une classe Tailwind — voir le
 * même piège documenté dans ring-metrics.ts/tsb-zones.ts pour une forme SVG
 * peinte via `fill`, ici utilisée aussi bien en CSS `background-color`
 * qu'en `fill` selon le contexte de rendu). Dégradé bleu→vert→jaune→
 * orange→rouge→violet, du plus facile au plus dur — même logique de
 * gradient que les autres échelles de sévérité déjà en place dans l'app
 * (tsb-zones.ts), pas une palette inventée pour l'occasion.
 */
const ZONE_COLORS: Record<number, string> = {
  1: '#94a3b8', // Récupération
  2: '#3b82f6', // Endurance
  3: '#22c55e', // Tempo
  4: '#eab308', // Seuil
  5: '#f97316', // VO2max
  6: '#ef4444', // Anaérobie
  7: '#a855f7', // Neuromusculaire
}

export interface ZoneInfo {
  zone: number
  label: string
  color: string
}

/** Classe un %FTP (réel ou cible) dans son échelle Coggan 7 zones (POWER_ZONES, ride-analysis-types.ts — même référentiel que l'analyse de sortie, pas une deuxième table). */
export function zoneForPct(pct: number): ZoneInfo {
  const found = POWER_ZONES.find((z) => pct >= z.minPct && (z.maxPct == null || pct < z.maxPct))
  const z = found ?? POWER_ZONES[POWER_ZONES.length - 1]
  return { zone: z.zone, label: z.label, color: ZONE_COLORS[z.zone] ?? ZONE_COLORS[1] }
}

export interface CompletedRideIntensityInput extends PowerFieldsLike {
  icu_intensity?: number | null
}

/**
 * Classification d'intensité pour une sortie RÉALISÉE, à partir de données
 * déjà chargées en liste (jamais un flux seconde-par-seconde — voir
 * l'avertissement en tête de fichier). Préfère `icu_intensity` (Intensity
 * Factor calculé par Intervals.icu lui-même = NP/FTP, déjà l'équivalent
 * d'un %FTP une fois ×100) ; à défaut, `bestAverageWatts()/ftp` (même
 * helper que le reste de l'app, jamais la puissance normalisée en premier
 * choix — voir son propre commentaire sur ce piège). Null si aucune des
 * deux n'est calculable (pas de FTP connu, pas de puissance) — le
 * calendrier affiche alors une marque "faite" neutre plutôt qu'une couleur
 * devinée.
 */
export function completedRideZone(activity: CompletedRideIntensityInput, ftp: number | null | undefined): ZoneInfo | null {
  if (activity.icu_intensity != null && activity.icu_intensity > 0) return zoneForPct(activity.icu_intensity * 100)
  if (ftp && ftp > 0) {
    const watts = bestAverageWatts(activity)
    if (watts != null) return zoneForPct((watts / ftp) * 100)
  }
  return null
}

/**
 * Zone d'intensité d'une séance planifiée — réelle une fois faite (activité
 * Intervals.icu rapprochée par date via `completion.actualDate`), cible
 * sinon (script structuré parsé, voir parseStructuredWorkoutProfile). Null
 * pour la musculation (pas de %FTP, un autre langage visuel — icône
 * haltère — s'applique côté UI) ou une séance sans script exploitable.
 * Partagée entre la vue semaine et la grille du plan entier
 * (plan-week-calendar.tsx / plan-overview-grid.tsx) pour ne jamais faire
 * diverger la couleur d'un même jour entre les deux vues.
 */
export function sessionZone(
  session: PlanWeekSessionWithValidation,
  completion: SessionCompletion,
  activities: IntervalsActivity[],
  athleteFtp: number | null | undefined
): ZoneInfo | null {
  if (session.sessionKind === 'strength') return null
  if (completion.status === 'done' && completion.actualDate) {
    const matched = activities.find((a) => a.start_date_local?.slice(0, 10) === completion.actualDate)
    if (matched) {
      const zone = completedRideZone(matched, athleteFtp)
      if (zone) return zone
    }
  }
  const avg = averageIntensityPct(parseStructuredWorkoutProfile(session.structuredWorkout))
  return avg != null ? zoneForPct(avg) : null
}
