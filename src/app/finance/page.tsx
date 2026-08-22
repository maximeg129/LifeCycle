"use client"

import React, { useMemo, useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  PiggyBank,
  Target,
  BarChart3,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useFinanceData } from '@/components/finance/use-finance-data'
import { AddExpenseDialog } from '@/components/finance/add-expense-dialog'
import { AddCategoryDialog } from '@/components/finance/add-category-dialog'
import { SetBudgetDialog } from '@/components/finance/set-budget-dialog'
import { SavingsGoalDialog } from '@/components/finance/savings-goal-dialog'
import { CATEGORY_ICONS, CATEGORY_COLORS, formatEuro, type ExpenseCategory, type BudgetAllocation } from '@/components/finance/finance-types'

type WithIdCategory = ExpenseCategory & { id: string }
type WithIdAllocation = BudgetAllocation & { id: string }

function monthLabel(monthId: string) {
  const [y, m] = monthId.split('-').map(Number)
  return format(new Date(y, m - 1, 1), 'MMM', { locale: fr })
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [budgetDialogCategory, setBudgetDialogCategory] = useState<WithIdCategory | null>(null)

  const {
    categories,
    allocations,
    financeSettings,
    isLoading,
    currentMonthId,
    monthIds,
    monthlySeries,
    savingsSeries,
    totalSavings,
    currentMonthLimit,
    totalSpentThisMonth,
    spentByCategory,
    recentTransactions,
  } = useFinanceData()

  const allocationByCategory = useMemo(() => {
    const map: Record<string, WithIdAllocation> = {}
    for (const a of allocations) map[a.categoryId] = a
    return map
  }, [allocations])

  const seriesForChart = useMemo(
    () => monthlySeries.map((point) => ({ month: monthLabel(point.month), ...point.byCategory })),
    [monthlySeries]
  )
  const savingsForChart = useMemo(
    () => savingsSeries.map((p) => ({ month: monthLabel(p.month), total: Math.round(p.cumulative) })),
    [savingsSeries]
  )

  const remaining = currentMonthLimit - totalSpentThisMonth
  const usedPct = currentMonthLimit > 0 ? Math.min(100, Math.round((totalSpentThisMonth / currentMonthLimit) * 100)) : 0
  const goalPct = financeSettings?.savingsGoalAmount ? Math.min(100, Math.round((totalSavings / financeSettings.savingsGoalAmount) * 100)) : 0

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Budget</h2>
            <h1 className="text-3xl font-bold">Finances Lifestyle</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-fit rounded-full px-4 py-1.5 text-xs font-bold border-primary/20 text-primary bg-primary/5">
              <Wallet className="w-3.5 h-3.5 mr-2" /> {format(new Date(), 'MMMM yyyy', { locale: fr })}
            </Badge>
            <AddExpenseDialog categories={categories} />
          </div>
        </header>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="overview" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <BarChart3 className="w-4 h-4 mr-2" /> Vue d&apos;ensemble
            </TabsTrigger>
            <TabsTrigger value="budgets" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Target className="w-4 h-4 mr-2" /> Budgets
            </TabsTrigger>
            <TabsTrigger value="savings" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <PiggyBank className="w-4 h-4 mr-2" /> Épargne
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted/20 animate-pulse" />)}
            </div>
          ) : (
          <>
          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dépensé ce mois</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{formatEuro(totalSpentThisMonth)}</div>
                {currentMonthLimit > 0 && (
                  <div className="flex items-center text-xs text-muted-foreground mt-2">
                    {remaining >= 0 ? <ArrowDownRight className="w-3 h-3 mr-1 text-green-500" /> : <ArrowUpRight className="w-3 h-3 mr-1 text-red-500" />}
                    <span className={cn('font-bold', remaining >= 0 ? 'text-green-500' : 'text-red-500')}>{formatEuro(Math.abs(remaining))}</span>
                    <span className="ml-1">{remaining >= 0 ? 'restant' : 'de dépassement'}</span>
                  </div>
                )}
              </Card>

              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <PiggyBank className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Épargne cumulée</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{formatEuro(totalSavings)}</div>
                <p className="text-xs text-muted-foreground mt-2">sur les {monthIds.length} derniers mois</p>
              </Card>

              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Budget mensuel</span>
                </div>
                {currentMonthLimit > 0 ? (
                  <>
                    <div className="text-3xl font-bold tracking-tight">{formatEuro(currentMonthLimit)}</div>
                    <Progress value={usedPct} className="h-1.5 mt-3" />
                    <p className="text-xs text-muted-foreground mt-2">{usedPct}% utilisé</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Aucun budget défini — voir l&apos;onglet Budgets</p>
                )}
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Évolution des dépenses
                </CardTitle>
              </CardHeader>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ajoutez des catégories et des dépenses pour voir apparaître ce graphique.</p>
              ) : (
                <>
                  <CardContent className="p-0 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={seriesForChart}>
                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
                        {categories.map((c) => (
                          <Bar key={c.id} dataKey={c.name} fill={CATEGORY_COLORS[c.color].chart} radius={[4, 4, 0, 0]} stackId="stack" />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                  <div className="flex flex-wrap gap-6 mt-4 text-xs text-muted-foreground">
                    {categories.map((c) => (
                      <span key={c.id} className="flex items-center gap-2">
                        <span className={cn('w-3 h-3 rounded-sm', CATEGORY_COLORS[c.color].dot)} /> {c.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight">Dernières transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune dépense enregistrée pour l&apos;instant.</p>
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{tx.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.date?.seconds ? format(new Date(tx.date.seconds * 1000), 'dd MMM', { locale: fr }) : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full text-[10px] font-bold border-none bg-secondary px-3 mr-4">
                          {tx.categoryName}
                        </Badge>
                        <span className="font-bold text-sm text-red-500">-{tx.amount.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budgets" className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-end">
              <AddCategoryDialog />
            </div>

            {categories.length === 0 ? (
              <div className="py-24 text-center opacity-60 space-y-4">
                <Target className="w-12 h-12 mx-auto" />
                <p className="font-bold text-sm">Aucune catégorie de budget pour l&apos;instant</p>
                <AddCategoryDialog />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {categories.map((category) => {
                    const Icon = CATEGORY_ICONS[category.icon]
                    const colors = CATEGORY_COLORS[category.color]
                    const allocation = allocationByCategory[category.id]
                    const spent = spentByCategory[category.id] || 0
                    const limitAmount = allocation?.limitAmount || 0
                    const pct = limitAmount > 0 ? Math.round((spent / limitAmount) * 100) : 0
                    const remainingCat = limitAmount - spent

                    return (
                      <Card key={category.id} className="apple-card border-none p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colors.bg)}>
                              <Icon className={cn('w-6 h-6', colors.text)} />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{category.name}</h3>
                              <p className="text-xs text-muted-foreground">{limitAmount > 0 ? `${limitAmount}€ / mois` : 'Aucun budget'}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setBudgetDialogCategory(category)}>
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-baseline">
                            <span className="text-3xl font-bold tracking-tight">{formatEuro(spent)}</span>
                            {limitAmount > 0 && (
                              <span className={cn('text-sm font-bold', pct > 90 ? 'text-red-500' : pct > 70 ? 'text-yellow-500' : 'text-green-500')}>
                                {pct}%
                              </span>
                            )}
                          </div>
                          {limitAmount > 0 && (
                            <>
                              <Progress value={Math.min(100, pct)} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {remainingCat >= 0 ? `${formatEuro(remainingCat)} restant` : `${formatEuro(Math.abs(remainingCat))} de dépassement`}
                              </p>
                            </>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <SetBudgetDialog
                  open={!!budgetDialogCategory}
                  onOpenChange={(o) => !o && setBudgetDialogCategory(null)}
                  category={budgetDialogCategory}
                  monthId={currentMonthId}
                  existingAllocation={budgetDialogCategory ? allocationByCategory[budgetDialogCategory.id] : undefined}
                />

                {totalSpentThisMonth > 0 && (
                  <Card className="apple-card border-none p-8">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-lg font-bold tracking-tight">Répartition globale</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="space-y-4">
                        {categories.filter((c) => (spentByCategory[c.id] || 0) > 0).map((c) => (
                          <div key={c.id} className="flex items-center gap-4">
                            <span className="text-sm font-bold w-28 truncate">{c.name}</span>
                            <div className="flex-1">
                              <Progress value={((spentByCategory[c.id] || 0) / totalSpentThisMonth) * 100} className="h-3" />
                            </div>
                            <span className="text-sm font-bold w-16 text-right">
                              {Math.round(((spentByCategory[c.id] || 0) / totalSpentThisMonth) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="savings" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="apple-card border-none p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <PiggyBank className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Épargne cumulée</span>
                    <div className="text-3xl font-bold tracking-tight">{formatEuro(totalSavings)}</div>
                  </div>
                </div>
                {financeSettings?.savingsGoalAmount ? (
                  <>
                    <Progress value={goalPct} className="h-2 mt-4" />
                    <p className="text-xs text-muted-foreground mt-2">{goalPct}% de l&apos;objectif ({formatEuro(financeSettings.savingsGoalAmount)})</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">Calculée à partir de vos budgets vs. dépenses réelles.</p>
                )}
              </Card>

              <Card className="apple-card border-none p-8 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Objectif</span>
                    <div className="text-2xl font-bold tracking-tight">{financeSettings?.savingsGoalLabel || 'Aucun objectif'}</div>
                  </div>
                </div>
                <SavingsGoalDialog current={financeSettings} />
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-green-500" /> Évolution de l&apos;épargne
                </CardTitle>
              </CardHeader>
              {savingsForChart.every((p) => p.total === 0) ? (
                <p className="text-sm text-muted-foreground">Définissez un budget mensuel par catégorie pour suivre votre épargne.</p>
              ) : (
                <CardContent className="p-0 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsForChart}>
                      <defs>
                        <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142 70% 45%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142 70% 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
                      <Area type="monotone" dataKey="total" stroke="hsl(142 70% 45%)" fill="url(#savingsGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              )}
            </Card>
          </TabsContent>
          </>
          )}
        </Tabs>
      </main>
    </div>
  )
}
