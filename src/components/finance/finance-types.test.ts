import { describe, it, expect } from 'vitest'
import {
  getMonthId,
  getLastMonthIds,
  sumExpenses,
  sumExpensesInMonth,
  sumExpensesByCategoryInMonth,
  buildMonthlySeries,
  buildSavingsSeries,
  formatEuro,
  type ExpenseLike,
} from './finance-types'

function ts(seconds: number) {
  return { seconds }
}

function dateSeconds(y: number, m: number, d: number) {
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000)
}

describe('getMonthId', () => {
  it('formats yyyy-MM with zero-padded month', () => {
    expect(getMonthId(new Date(2026, 0, 15))).toBe('2026-01')
    expect(getMonthId(new Date(2026, 10, 1))).toBe('2026-11')
  })
})

describe('getLastMonthIds', () => {
  it('returns count months ending at `from`, oldest first', () => {
    const ids = getLastMonthIds(3, new Date(2026, 2, 10)) // March 2026
    expect(ids).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('handles year rollover', () => {
    const ids = getLastMonthIds(3, new Date(2026, 0, 10)) // Jan 2026
    expect(ids).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('expense aggregation', () => {
  const expenses: ExpenseLike[] = [
    { amount: 50, categoryId: 'bike', categoryName: 'Cyclisme', date: ts(dateSeconds(2026, 3, 5)) },
    { amount: 30, categoryId: 'food', categoryName: 'Nutrition', date: ts(dateSeconds(2026, 3, 20)) },
    { amount: 100, categoryId: 'bike', categoryName: 'Cyclisme', date: ts(dateSeconds(2026, 2, 1)) },
    { amount: 10, categoryId: 'food', categoryName: 'Nutrition', date: null },
  ]

  it('sumExpenses totals everything regardless of date', () => {
    expect(sumExpenses(expenses)).toBe(190)
  })

  it('sumExpensesInMonth filters to the given month', () => {
    expect(sumExpensesInMonth(expenses, '2026-03')).toBe(80)
    expect(sumExpensesInMonth(expenses, '2026-02')).toBe(100)
    expect(sumExpensesInMonth(expenses, '2026-04')).toBe(0)
  })

  it('excludes expenses with no date from every monthly bucket', () => {
    const totalAcrossMonths = sumExpensesInMonth(expenses, '2026-02') + sumExpensesInMonth(expenses, '2026-03')
    // The dateless 10€ entry should never surface in a month total.
    expect(totalAcrossMonths).toBe(180)
  })

  it('sumExpensesByCategoryInMonth buckets by categoryId', () => {
    expect(sumExpensesByCategoryInMonth(expenses, '2026-03')).toEqual({ bike: 50, food: 30 })
  })

  it('buildMonthlySeries returns one point per month with per-category totals', () => {
    const series = buildMonthlySeries(expenses, ['2026-02', '2026-03'])
    expect(series).toEqual([
      { month: '2026-02', total: 100, byCategory: { Cyclisme: 100 } },
      { month: '2026-03', total: 80, byCategory: { Cyclisme: 50, Nutrition: 30 } },
    ])
  })
})

describe('buildSavingsSeries', () => {
  it('accumulates limit-minus-spent per month, skipping months with no budget', () => {
    const months = ['2026-01', '2026-02', '2026-03']
    const limits = { '2026-01': 200, '2026-03': 300 } // no budget set for Feb
    const spent = { '2026-01': 150, '2026-02': 999, '2026-03': 250 }

    const series = buildSavingsSeries(months, limits, spent)

    expect(series).toEqual([
      { month: '2026-01', monthlySavings: 50, cumulative: 50 },
      { month: '2026-02', monthlySavings: 0, cumulative: 50 }, // no budget -> contributes 0
      { month: '2026-03', monthlySavings: 50, cumulative: 100 },
    ])
  })

  it('allows negative monthly savings (overspend) to reduce the cumulative total', () => {
    const series = buildSavingsSeries(['2026-01'], { '2026-01': 100 }, { '2026-01': 150 })
    expect(series[0].monthlySavings).toBe(-50)
    expect(series[0].cumulative).toBe(-50)
  })
})

describe('formatEuro', () => {
  it('formats with the euro sign and no decimals', () => {
    // Thousands separator character depends on the ICU data available (regular
    // vs. narrow no-break space), so match loosely rather than pinning a byte.
    expect(formatEuro(1234)).toMatch(/^1.234€$/)
    expect(formatEuro(0)).toBe('0€')
  })
})
