// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}

export interface MealLog {
  userId: string
  label: string
  mealType: MealType
  recipeId?: string | null
  calories: number
  protein: number
  carbs: number
  date: { seconds: number; nanoseconds: number } | null
  createdAt?: unknown
}

export interface HydrationLog {
  userId: string
  liters: number
  updatedAt?: unknown
}

export interface NutritionGoals {
  calorieTarget?: number
  proteinTarget?: number
  carbsTarget?: number
  hydrationTargetLiters?: number
  updatedAt?: unknown
}

export const DEFAULT_GOALS: Required<Pick<NutritionGoals, 'calorieTarget' | 'proteinTarget' | 'carbsTarget' | 'hydrationTargetLiters'>> = {
  calorieTarget: 2600,
  proteinTarget: 160,
  carbsTarget: 320,
  hydrationTargetLiters: 3.5,
}

// ── Pure helpers (unit-tested, no Firebase deps) ─────────────────────────

/** 'yyyy-MM-dd' id for a given date, in local time. */
export function getDayId(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface MealLogLike {
  calories: number
  protein: number
  carbs: number
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
}

export function sumMeals(meals: MealLogLike[]): MacroTotals {
  return meals.reduce(
    (acc, m) => ({ calories: acc.calories + (m.calories || 0), protein: acc.protein + (m.protein || 0), carbs: acc.carbs + (m.carbs || 0) }),
    { calories: 0, protein: 0, carbs: 0 }
  )
}

/** 0-100, capped at 100 even if the target is exceeded. */
export function progressPct(current: number, target: number): number {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}
