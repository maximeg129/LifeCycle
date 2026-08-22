import {
  Bike,
  CookingPot,
  ShoppingCart,
  Home,
  Car,
  Gamepad2,
  Plane,
  Heart,
  Wallet,
  Shirt,
  type LucideIcon,
} from 'lucide-react'

// ── Firestore document shapes (client-side, ids added by useCollection/useDoc) ──

export interface ExpenseCategory {
  userId: string
  name: string
  icon: CategoryIconKey
  color: CategoryColorKey
  createdAt?: unknown
}

export interface Expense {
  userId: string
  label: string
  amount: number
  categoryId: string
  categoryName: string
  date: { seconds: number; nanoseconds: number } | null
  createdAt?: unknown
}

export interface MonthlyBudget {
  userId: string
  month: string // 'yyyy-MM'
  totalLimit: number
  createdAt?: unknown
  updatedAt?: unknown
}

export interface BudgetAllocation {
  userId: string
  monthlyBudgetId: string
  categoryId: string
  categoryName: string
  icon: CategoryIconKey
  color: CategoryColorKey
  limitAmount: number
  createdAt?: unknown
  updatedAt?: unknown
}

export interface FinanceSettings {
  savingsGoalLabel?: string
  savingsGoalAmount?: number
  updatedAt?: unknown
}

// ── Category taxonomy (icon + color pickers) ─────────────────────────────

export const CATEGORY_ICONS = {
  bike: Bike,
  food: CookingPot,
  shopping: ShoppingCart,
  home: Home,
  car: Car,
  leisure: Gamepad2,
  travel: Plane,
  health: Heart,
  clothing: Shirt,
  other: Wallet,
} as const satisfies Record<string, LucideIcon>

export type CategoryIconKey = keyof typeof CATEGORY_ICONS

export const CATEGORY_ICON_LABELS: Record<CategoryIconKey, string> = {
  bike: 'Cyclisme',
  food: 'Alimentation',
  shopping: 'Shopping',
  home: 'Maison',
  car: 'Transport',
  leisure: 'Loisirs',
  travel: 'Voyage',
  health: 'Santé',
  clothing: 'Vêtements',
  other: 'Autre',
}

export const CATEGORY_COLORS = {
  primary: { text: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary', chart: 'hsl(var(--primary))' },
  orange: { text: 'text-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500', chart: 'hsl(25 95% 53%)' },
  pink: { text: 'text-pink-500', bg: 'bg-pink-500/10', dot: 'bg-pink-500', chart: 'hsl(330 81% 60%)' },
  green: { text: 'text-green-500', bg: 'bg-green-500/10', dot: 'bg-green-500', chart: 'hsl(142 70% 45%)' },
  blue: { text: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500', chart: 'hsl(217 91% 60%)' },
  purple: { text: 'text-purple-500', bg: 'bg-purple-500/10', dot: 'bg-purple-500', chart: 'hsl(271 81% 66%)' },
  red: { text: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500', chart: 'hsl(0 84% 60%)' },
  yellow: { text: 'text-yellow-500', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500', chart: 'hsl(45 93% 47%)' },
} as const

export type CategoryColorKey = keyof typeof CATEGORY_COLORS

// ── Pure helpers (unit-tested, no Firebase deps) ─────────────────────────

/** 'yyyy-MM' id for a given date, in local time. */
export function getMonthId(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Returns the last `count` month ids ending with the given date's month, oldest first. */
export function getLastMonthIds(count: number, from: Date = new Date()): string[] {
  const ids: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    ids.push(getMonthId(d))
  }
  return ids
}

export interface ExpenseLike {
  amount: number
  categoryId: string
  categoryName: string
  date: { seconds: number } | null
}

function monthIdFromExpense(e: ExpenseLike): string | null {
  if (!e.date?.seconds) return null
  return getMonthId(new Date(e.date.seconds * 1000))
}

export function sumExpenses(expenses: ExpenseLike[]): number {
  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
}

export function sumExpensesInMonth(expenses: ExpenseLike[], monthId: string): number {
  return sumExpenses(expenses.filter((e) => monthIdFromExpense(e) === monthId))
}

/** categoryId -> total spent, for a given month. */
export function sumExpensesByCategoryInMonth(expenses: ExpenseLike[], monthId: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of expenses) {
    if (monthIdFromExpense(e) !== monthId) continue
    out[e.categoryId] = (out[e.categoryId] || 0) + (e.amount || 0)
  }
  return out
}

export interface MonthlyStackedPoint {
  month: string
  total: number
  byCategory: Record<string, number> // categoryName -> amount
}

/** One point per monthId, with per-category totals for a stacked chart. */
export function buildMonthlySeries(expenses: ExpenseLike[], monthIds: string[]): MonthlyStackedPoint[] {
  return monthIds.map((monthId) => {
    const inMonth = expenses.filter((e) => monthIdFromExpense(e) === monthId)
    const byCategory: Record<string, number> = {}
    for (const e of inMonth) {
      byCategory[e.categoryName] = (byCategory[e.categoryName] || 0) + (e.amount || 0)
    }
    return { month: monthId, total: sumExpenses(inMonth), byCategory }
  })
}

export interface SavingsPoint {
  month: string
  monthlySavings: number
  cumulative: number
}

/**
 * cumulative "money saved" = running sum of (budget limit - actual spend) per month.
 * A month with no budget set contributes 0 (nothing to compare against yet).
 */
export function buildSavingsSeries(
  monthIds: string[],
  totalLimitByMonth: Record<string, number>,
  totalSpentByMonth: Record<string, number>
): SavingsPoint[] {
  let running = 0
  return monthIds.map((month) => {
    const limit = totalLimitByMonth[month] || 0
    const spent = totalSpentByMonth[month] || 0
    const monthlySavings = limit > 0 ? limit - spent : 0
    running += monthlySavings
    return { month, monthlySavings, cumulative: running }
  })
}

export function formatEuro(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
}
