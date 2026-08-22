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
