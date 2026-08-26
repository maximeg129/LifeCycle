// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

export interface HealthMetric {
  userId: string
  date: { seconds: number; nanoseconds: number } | null
  sleepHours?: number
  sleepQuality?: number // 0-100
  hrv?: number // ms
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
  mood?: number
  readiness?: number
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
  const sleepQualityFromWellness = wellness.sleepQuality ?? wellness.sleepScore
  return {
    date: manual?.date ?? null,
    sleepHours: manual?.sleepHours ?? sleepHoursFromWellness,
    sleepQuality: manual?.sleepQuality ?? sleepQualityFromWellness,
    hrv: manual?.hrv ?? wellness.hrv,
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
    if (d.sleepHours !== undefined || d.sleepQuality !== undefined || d.hrv !== undefined || d.stressScore !== undefined || d.mood !== undefined) {
      return d
    }
  }
  return undefined
}

/** Lightweight 0-100 readiness heuristic from the most recent entry — not a medical score. */
export function computeReadiness(latest: HealthMetricLike | undefined): number | null {
  if (!latest) return null
  const parts: number[] = []
  if (latest.sleepQuality !== undefined) parts.push(latest.sleepQuality)
  if (latest.stressScore !== undefined) parts.push(100 - latest.stressScore)
  if (latest.mood !== undefined) parts.push(latest.mood * 10)
  if (parts.length === 0) return null
  return Math.round(average(parts))
}

/** Prefers the device's own 0-100 recovery/readiness score (WHOOP via Intervals.icu) over the local sleep/stress/mood heuristic — it's a more authoritative measurement when available. */
export function resolveReadiness(latest: HealthMetricLike | undefined, deviceReadiness: number | undefined): number | null {
  if (deviceReadiness != null) return Math.round(deviceReadiness)
  return computeReadiness(latest)
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
