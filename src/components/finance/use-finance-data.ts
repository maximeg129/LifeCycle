"use client"

import { useMemo } from 'react'
import { collection, doc, query, orderBy, limit, where, Timestamp } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase'
import {
  type ExpenseCategory,
  type Expense,
  type MonthlyBudget,
  type BudgetAllocation,
  type FinanceSettings,
  getLastMonthIds,
  sumExpensesInMonth,
  sumExpensesByCategoryInMonth,
  buildMonthlySeries,
  buildSavingsSeries,
  sumExpenses,
} from './finance-types'

const HISTORY_MONTHS = 6

export function useFinanceData() {
  const { user } = useUser()
  const db = useFirestore()
  const uid = user?.uid ?? null

  const monthIds = useMemo(() => getLastMonthIds(HISTORY_MONTHS), [])
  const currentMonthId = monthIds[monthIds.length - 1]

  // Categories (taxonomy, not budget-scoped)
  const categoriesQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    return query(collection(db, `users/${uid}/expenseCategories`), orderBy('name'))
  }, [db, uid])
  const { data: categories, isLoading: loadingCategories } = useCollection<ExpenseCategory>(categoriesQuery)

  // Expenses in the last HISTORY_MONTHS months
  const expensesQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    const start = new Date()
    start.setMonth(start.getMonth() - (HISTORY_MONTHS - 1))
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return query(
      collection(db, `users/${uid}/expenses`),
      where('date', '>=', Timestamp.fromDate(start)),
      orderBy('date', 'desc')
    )
  }, [db, uid])
  const { data: expenses, isLoading: loadingExpenses } = useCollection<Expense>(expensesQuery)

  // Current month's budget doc + its per-category allocations
  const currentBudgetRef = useMemoFirebase(() => {
    if (!uid || !db) return null
    return doc(db, `users/${uid}/monthlyBudgets/${currentMonthId}`)
  }, [db, uid, currentMonthId])
  const { data: currentBudget, isLoading: loadingCurrentBudget } = useDoc<MonthlyBudget>(currentBudgetRef)

  const allocationsQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    return collection(db, `users/${uid}/monthlyBudgets/${currentMonthId}/budgetAllocations`)
  }, [db, uid, currentMonthId])
  const { data: allocations, isLoading: loadingAllocations } = useCollection<BudgetAllocation>(allocationsQuery)

  // Last HISTORY_MONTHS budget docs, for the savings trend
  const budgetsHistoryQuery = useMemoFirebase(() => {
    if (!uid || !db) return null
    return query(collection(db, `users/${uid}/monthlyBudgets`), orderBy('month', 'desc'), limit(HISTORY_MONTHS))
  }, [db, uid])
  const { data: budgetsHistory, isLoading: loadingBudgetsHistory } = useCollection<MonthlyBudget>(budgetsHistoryQuery)

  // Savings goal (singleton settings doc)
  const financeSettingsRef = useMemoFirebase(() => {
    if (!uid || !db) return null
    return doc(db, `users/${uid}/settings/finance`)
  }, [db, uid])
  const { data: financeSettings, isLoading: loadingSettings } = useDoc<FinanceSettings>(financeSettingsRef)

  const isLoading =
    loadingCategories || loadingExpenses || loadingCurrentBudget || loadingAllocations || loadingBudgetsHistory || loadingSettings

  const derived = useMemo(() => {
    const exp = expenses || []
    const totalSpentThisMonth = sumExpensesInMonth(exp, currentMonthId)
    const spentByCategory = sumExpensesByCategoryInMonth(exp, currentMonthId)
    const monthlySeries = buildMonthlySeries(exp, monthIds)

    const totalLimitByMonth: Record<string, number> = {}
    for (const b of budgetsHistory || []) totalLimitByMonth[b.month] = b.totalLimit || 0
    const totalSpentByMonth: Record<string, number> = {}
    for (const monthId of monthIds) totalSpentByMonth[monthId] = sumExpensesInMonth(exp, monthId)

    const savingsSeries = buildSavingsSeries(monthIds, totalLimitByMonth, totalSpentByMonth)
    const totalSavings = savingsSeries.length ? savingsSeries[savingsSeries.length - 1].cumulative : 0

    const currentMonthLimit = currentBudget?.totalLimit || 0
    const recentTransactions = exp.slice(0, 8)

    return {
      totalSpentThisMonth,
      spentByCategory,
      monthlySeries,
      savingsSeries,
      totalSavings,
      currentMonthLimit,
      recentTransactions,
      totalExpensesThisPeriod: sumExpenses(exp),
    }
  }, [expenses, currentMonthId, monthIds, budgetsHistory, currentBudget])

  return {
    uid,
    db,
    currentMonthId,
    monthIds,
    categories: categories || [],
    expenses: expenses || [],
    allocations: allocations || [],
    currentBudget,
    financeSettings,
    isLoading,
    ...derived,
  }
}
