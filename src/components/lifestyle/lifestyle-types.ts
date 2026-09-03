// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

import { windowedTrendSignal, type DatedValue, type Signal } from '@/components/cycling/governor-types'
import { GOVERNOR_BASELINE_WINDOW, requireConstant } from '@/domain/cycling/evidence/constants'

export interface HealthMetric {
  userId: string
  date: { seconds: number; nanoseconds: number } | null
  sleepHours?: number
  sleepQuality?: number // 0-100
  hrv?: number // ms
  restingHR?: number // bpm
  stressScore?: number // 0-100, lower is better
  mood?: number // 0-10
  bedTime?: string // 'HH:mm'
  createdAt?: unknown
  updatedAt?: unknown
}

export type GoalMetric = 'sleepHours' | 'sleepQuality' | 'hrv' | 'stressScore' | 'mood'
export type GoalDirection = 'min' | 'max' // 'min' = at least target, 'max' = at most target

export interface HealthGoal {
  userId: string
  label: string
  metric: GoalMetric
  target: number
  direction: GoalDirection
  createdAt?: unknown
}

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  sleepHours: 'Heures de sommeil',
  sleepQuality: 'Qualité de sommeil (%)',
  hrv: 'HRV (ms)',
  stressScore: 'Score de stress',
  mood: 'Humeur',
}

// ── Pure helpers (unit-tested, no Firebase deps) ─────────────────────────

/** 'yyyy-MM-dd' id for a given date, in local time. */
export function getDayId(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inverse of getDayId — local midnight for a 'yyyy-MM-dd' id, as epoch seconds. */
export function dayIdToSeconds(dayId: string): number {
  const [y, m, d] = dayId.split('-').map(Number)
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000)
}

/** Returns the last `count` day ids ending with `from`, oldest first. */
export function getLastDayIds(count: number, from: Date = new Date()): string[] {
  const ids: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from)
    d.setDate(d.getDate() - i)
    ids.push(getDayId(d))
  }
  return ids
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Percent change from `from` to `to`; 0 if `from` is 0. */
export function trendPct(from: number, to: number): number {
  if (from === 0) return 0
  return Math.round(((to - from) / from) * 100)
}

export interface HealthMetricLike {
  date: { seconds: number } | null
  sleepHours?: number
  sleepQuality?: number
  hrv?: number
  restingHR?: number
  stressScore?: number
  mood?: number
}

function dayIdFromMetric(m: HealthMetricLike): string | null {
  if (!m.date?.seconds) return null
  return getDayId(new Date(m.date.seconds * 1000))
}

/** One point per dayId (short weekday-ish label left to the caller), values undefined where no entry exists. */
export function buildDailySeries<T extends HealthMetricLike>(metrics: T[], dayIds: string[]): (T & { dayId: string })[] {
  const byDay = new Map<string, T>()
  for (const m of metrics) {
    const id = dayIdFromMetric(m)
    if (id) byDay.set(id, m)
  }
  return dayIds.map((dayId) => ({ ...(byDay.get(dayId) as T), dayId }))
}

/**
 * A day's auto-synced Intervals.icu wellness reading (WHOOP or any other
 * connected device that feeds Intervals.icu) — the fields this app can
 * meaningfully fold into the manually-logged journal.
 */
export interface WellnessLike {
  sleepSecs?: number
  sleepScore?: number
  sleepQuality?: number
  hrv?: number
  restingHR?: number
  mood?: number
  readiness?: number
}

export type SleepQualityBand = 'great' | 'good' | 'average' | 'poor'

/**
 * Intervals.icu's own band boundaries for its derived `sleepQuality`
 * field (confirmed against their public Wellness Fields doc and a live
 * account — a screenshot showing score 82 alongside "Q2"): 1=Great
 * 90-100, 2=Good 80-89, 3=Average 60-79, 4=Poor <60. Exposed so any UI
 * wanting a "how good was this night" color/label can classify the same
 * 0-100 score this app already stores, rather than re-reading the raw
 * (and, per mergeDailyWellness below, not directly usable) 1-4 field.
 */
export function sleepQualityBand(score: number): SleepQualityBand {
  if (score >= 90) return 'great'
  if (score >= 80) return 'good'
  if (score >= 60) return 'average'
  return 'poor'
}

/** Reverse of the boundaries above — each band's midpoint, only used as a fallback for the (per Intervals.icu's own docs, unlikely) case a source supplies the 1-4 band without the score it's derived from. */
function sleepQualityBandToScore(band: number | undefined): number | undefined {
  if (band == null) return undefined
  if (band <= 1) return 95
  if (band === 2) return 85
  if (band === 3) return 70
  return 50
}

/**
 * Fills gaps in a manually-logged day with the matching auto-synced
 * wellness reading — the manual entry always wins field-by-field when
 * present, so a correction the user typed in is never silently overwritten,
 * but a day nobody logged by hand still shows real data instead of "—".
 */
export function mergeDailyWellness(manual: HealthMetricLike | undefined, wellness: WellnessLike | undefined): HealthMetricLike | undefined {
  if (!wellness) return manual
  const sleepHoursFromWellness = wellness.sleepSecs != null ? Math.round((wellness.sleepSecs / 3600) * 10) / 10 : undefined
  // Bug caught live (user feedback, a screenshot of their own Intervals.icu
  // day view showing "82 Q2" side by side): wellness.sleepQuality is NOT a
  // percentage — it's Intervals.icu's own derived 1-4 band (1=Great 90-100,
  // 2=Good 80-89, 3=Average 60-79, 4=Poor <60, confirmed against their
  // public Wellness Fields doc), computed FROM sleepScore. This app's
  // sleepQuality field means "0-100" everywhere else (UI %, AI prompts,
  // readiness computation, manual entry) — preferring the raw category
  // here silently turned a "Good" night (2) into "Qualité 2%". sleepScore
  // is the real 0-100 value; sleepQualityBandToScore() is only a fallback
  // for the (per Intervals.icu's own docs, unlikely) case a source
  // supplies the band without the score it's derived from.
  const sleepQualityFromWellness = wellness.sleepScore ?? sleepQualityBandToScore(wellness.sleepQuality)
  return {
    date: manual?.date ?? null,
    sleepHours: manual?.sleepHours ?? sleepHoursFromWellness,
    sleepQuality: manual?.sleepQuality ?? sleepQualityFromWellness,
    hrv: manual?.hrv ?? wellness.hrv,
    restingHR: manual?.restingHR ?? wellness.restingHR,
    stressScore: manual?.stressScore, // no reliable auto-synced equivalent — manual only
    mood: manual?.mood ?? wellness.mood,
  }
}

/**
 * Builds the daily series by merging manually-logged metrics with
 * auto-synced wellness readings (matched by dayId — Intervals.icu wellness
 * rows are already keyed by their date string). This is what makes Vie &
 * Santé reflect a connected WHOOP/Intervals.icu account without requiring
 * the user to re-type numbers the device already captured.
 */
export function buildMergedDailySeries(manualMetrics: HealthMetricLike[], wellnessByDay: Map<string, WellnessLike>, dayIds: string[]): (HealthMetricLike & { dayId: string })[] {
  const manualByDay = new Map<string, HealthMetricLike>()
  for (const m of manualMetrics) {
    const id = dayIdFromMetric(m)
    if (id) manualByDay.set(id, m)
  }
  return dayIds.map((dayId) => {
    const merged = mergeDailyWellness(manualByDay.get(dayId), wellnessByDay.get(dayId)) ?? { date: null }
    // The day's date always reflects dayId, not just whatever the manual doc's
    // Timestamp happened to carry — so a wellness-only day (no manual entry)
    // still displays correctly as "last measured" once it has any data.
    const date = merged.date ?? { seconds: dayIdToSeconds(dayId) }
    return { ...merged, date, dayId }
  })
}

/** Most recent day in `series` (oldest-first) that has at least one field set — "latest" should reflect the newest real data point, not just today's empty slot. */
export function pickLatestWithData<T extends HealthMetricLike>(series: (T & { dayId: string })[]): (T & { dayId: string }) | undefined {
  for (let i = series.length - 1; i >= 0; i--) {
    const d = series[i]
    if (d.sleepHours !== undefined || d.sleepQuality !== undefined || d.hrv !== undefined || d.restingHR !== undefined || d.stressScore !== undefined || d.mood !== undefined) {
      return d
    }
  }
  return undefined
}

/**
 * The most recent value for `field` strictly before `beforeDayId` — the
 * "yesterday" side of a day-over-day trend indicator (see vitalTrend()).
 * Walks back past any gap day with that field missing, same idea as
 * pickLatestWithData() but scoped to one field and starting one day
 * before the reference day rather than from the end of the series.
 */
export function previousValue<T extends HealthMetricLike, K extends keyof T>(
  series: (T & { dayId: string })[],
  beforeDayId: string,
  field: K
): T[K] | undefined {
  const idx = series.findIndex((d) => d.dayId === beforeDayId)
  if (idx <= 0) return undefined
  for (let i = idx - 1; i >= 0; i--) {
    const v = series[i][field]
    if (v !== undefined) return v
  }
  return undefined
}

export type VitalTrend = 'good' | 'bad' | 'neutral'

/**
 * Day-over-day trend for a vital sign with a clear "better direction" —
 * user feedback: "un petit indicateur flèche rouge/vert... une petite led
 * rouge/vert/jaune l'évolution vis à vis de la veille". `direction` says
 * which way is an improvement (resting HR: lower is better; HRV: higher
 * is better) — `'neutral'` (yellow) only for an exact tie, not a dead
 * zone around it, since both metrics are already whole-number readings
 * with no meaningful sub-unit noise to filter out.
 */
export function vitalTrend(current: number | undefined, previous: number | undefined, direction: 'lower-better' | 'higher-better'): VitalTrend | null {
  if (current == null || previous == null) return null
  if (current === previous) return 'neutral'
  const improved = direction === 'lower-better' ? current < previous : current > previous
  return improved ? 'good' : 'bad'
}

/**
 * Formats decimal hours as "XhYY" (e.g. 7.5 -> "7h30") — matching the
 * app's existing duration convention (rides-journal-tab.tsx's
 * formatDuration) rather than a bare "7.5h", which reads as a typo of
 * "75h" at a glance and isn't how anyone actually thinks about a night's
 * sleep. User feedback: "pour tous ne donne pas les décimales".
 */
export function formatSleepDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Nombre de jours d'historique à fetcher AU-DELÀ de la fenêtre affichée
 * pour que computeReadiness() puisse comparer HRV/FC repos à une ligne de
 * base — réutilise GOVERNOR_BASELINE_WINDOW (même fenêtre ≥4 semaines déjà
 * utilisée par le gouverneur de charge interne pour exactement le même
 * besoin, principle-2 dans evidence/rules.ts : "HRV, sommeil et bien-être
 * s'interprètent... rapportée à une ligne de base individuelle établie sur
 * ≥ 4 semaines") plutôt qu'une deuxième fenêtre inventée pour l'occasion.
 */
export function readinessBaselineLookbackDays(): number {
  return requireConstant(GOVERNOR_BASELINE_WINDOW, 'GOVERNOR_BASELINE_WINDOW').baselineDays
}

/**
 * Convertit un Signal (windowedTrendSignal — tendance récente 7j vs ligne
 * de base ≥4 semaines, jamais une valeur isolée) sur la même échelle 0-100
 * que les autres composantes de computeReadiness. `null` (composante
 * omise, jamais un 50 par défaut trompeur) tant qu'il n'y a pas assez de
 * points dans les deux fenêtres — voir windowedTrendSignal.
 */
function trendToReadinessScore(signal: Signal): number | null {
  if (signal == null) return null
  return signal === 1 ? 100 : signal === -1 ? 0 : 50
}

/**
 * Lightweight 0-100 readiness heuristic — not a medical score. Always
 * computed here, never a connected device's own proprietary recovery/
 * readiness score (WHOOP via Intervals.icu) — retour utilisateur, suite à
 * l'audit des indicateurs de Cyclisme : "éviter tous indicateurs qui
 * restent propriétaires". Cette fonction remplace resolveReadiness() (qui
 * préférait le score du capteur quand présent) pour honorer la règle déjà
 * écrite dans ce projet — voir readiness-composition-explicit-weighting,
 * evidence/rules.ts : la composition du score readiness doit avoir "une
 * pondération explicite et visible/modifiable par l'utilisateur", ce
 * qu'un score de capteur en boîte noire ne peut pas offrir.
 *
 * `history` (optionnel) ajoute HRV et FC repos comme deux composantes
 * supplémentaires — retour utilisateur, après un readiness très éloigné du
 * score WHOOP : "j'ai pas de data point en input n'utilisons pas ces
 * indicateurs, je suis d'accord sur le changement et l'intégration hrv et
 * fc". Chacune est une TENDANCE (fenêtre récente 7j vs ligne de base ≥4
 * semaines, via windowedTrendSignal — déjà utilisé par le gouverneur de
 * charge interne pour ce même calcul, pas un deuxième algorithme), jamais
 * une valeur brute du jour comparée à un seuil absolu : le HRV varie
 * énormément d'une personne à l'autre (voir la tuile HRV), seule la
 * trajectoire par rapport à SA PROPRE ligne de base a un sens. Omise
 * (jamais un 50 par défaut) si `history` est absent, si HRV/FC repos n'ont
 * aucune valeur ce jour-là, ou si l'historique ne couvre pas encore assez
 * de jours pour établir une ligne de base (`windowedTrendSignal` l'exige
 * déjà — voir readinessBaselineLookbackDays() ci-dessus pour la fenêtre à
 * fetcher côté appelant). ⚠️ Le signe d'une variation de HRV reste
 * ambigu en soi (principle-3-hrv-sign-ambiguous, evidence/rules.ts — une
 * hausse comme une baisse peuvent signaler une adaptation négative chez un
 * athlète entraîné) : cette composante ne décide donc jamais seule, elle
 * n'est qu'une parmi 3 à 5 dans une moyenne, jamais affichée isolément
 * comme "HRV en baisse = fatigue" (forbidden-hrv-sign-fatigue-freshness).
 */
export function computeReadiness(
  latest: (HealthMetricLike & { dayId?: string }) | undefined,
  history?: (HealthMetricLike & { dayId: string })[]
): number | null {
  if (!latest) return null
  const parts: number[] = []
  if (latest.sleepQuality !== undefined) parts.push(latest.sleepQuality)
  if (latest.stressScore !== undefined) parts.push(100 - latest.stressScore)
  if (latest.mood !== undefined) parts.push(latest.mood * 10)

  if (history && latest.dayId) {
    const referenceIso = latest.dayId
    const hrvSeries: DatedValue[] = history.filter((d) => d.hrv != null).map((d) => ({ date: d.dayId, value: d.hrv as number }))
    const hrvScore = trendToReadinessScore(windowedTrendSignal(hrvSeries, referenceIso, 'higher'))
    if (hrvScore != null) parts.push(hrvScore)

    const rhrSeries: DatedValue[] = history.filter((d) => d.restingHR != null).map((d) => ({ date: d.dayId, value: d.restingHR as number }))
    const rhrScore = trendToReadinessScore(windowedTrendSignal(rhrSeries, referenceIso, 'lower'))
    if (rhrScore != null) parts.push(rhrScore)
  }

  if (parts.length === 0) return null
  return Math.round(average(parts))
}

export interface GoalProgress {
  currentAvg: number
  pct: number // 0-100, 100 = goal met or exceeded
  met: boolean
}

/** Progress of a goal against the average of `recentMetrics` for its target metric. */
export function computeGoalProgress(goal: { metric: GoalMetric; target: number; direction: GoalDirection }, recentMetrics: HealthMetricLike[]): GoalProgress {
  const values = recentMetrics.map((m) => m[goal.metric]).filter((v): v is number => v !== undefined)
  const currentAvg = average(values)
  if (values.length === 0 || goal.target === 0) return { currentAvg: 0, pct: 0, met: false }

  if (goal.direction === 'min') {
    const pct = Math.min(100, Math.round((currentAvg / goal.target) * 100))
    return { currentAvg, pct, met: currentAvg >= goal.target }
  }
  // direction === 'max': being under target is 100%, going over degrades the score
  const pct = currentAvg <= goal.target ? 100 : Math.max(0, Math.round((goal.target / currentAvg) * 100))
  return { currentAvg, pct, met: currentAvg <= goal.target }
}
