"use client"

import React, { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  PiggyBank,
  Bike,
  CookingPot,
  ShoppingCart,
  Target,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'

const monthlyData = [
  { month: 'Oct', cyclisme: 180, nutrition: 380, divers: 220 },
  { month: 'Nov', cyclisme: 145, nutrition: 410, divers: 190 },
  { month: 'Déc', cyclisme: 320, nutrition: 450, divers: 350 },
  { month: 'Jan', cyclisme: 95, nutrition: 390, divers: 180 },
  { month: 'Fév', cyclisme: 210, nutrition: 420, divers: 200 },
  { month: 'Mar', cyclisme: 145, nutrition: 405, divers: 175 },
]

const savingsData = [
  { month: 'Oct', total: 1200 },
  { month: 'Nov', total: 1450 },
  { month: 'Déc', total: 1100 },
  { month: 'Jan', total: 1650 },
  { month: 'Fév', total: 2050 },
  { month: 'Mar', total: 2450 },
]

const recentTransactions = [
  { label: "Chambre à air Continental", category: "Cyclisme", amount: -12.90, date: "15 Mar" },
  { label: "Marché bio hebdo", category: "Nutrition", amount: -67.30, date: "14 Mar" },
  { label: "Abonnement Intervals.icu", category: "Cyclisme", amount: -10.00, date: "12 Mar" },
  { label: "Protéines whey (2kg)", category: "Nutrition", amount: -45.00, date: "10 Mar" },
  { label: "Gants hiver Castelli", category: "Cyclisme", amount: -89.00, date: "8 Mar" },
  { label: "Courses Leclerc", category: "Nutrition", amount: -98.50, date: "7 Mar" },
]

const budgets = [
  { label: "Cyclisme", icon: Bike, spent: 145, limit: 200, color: "text-primary", bg: "bg-primary/10" },
  { label: "Alimentation", icon: CookingPot, spent: 405, limit: 500, color: "text-orange-500", bg: "bg-orange-500/10" },
  { label: "Shopping", icon: ShoppingCart, spent: 95, limit: 150, color: "text-pink-500", bg: "bg-pink-500/10" },
]

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview')

  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0)

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Budget</h2>
            <h1 className="text-3xl font-bold">Finances Lifestyle</h1>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-4 py-1.5 text-xs font-bold border-primary/20 text-primary bg-primary/5">
            <Wallet className="w-3.5 h-3.5 mr-2" /> Mars 2026
          </Badge>
        </header>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="overview" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <BarChart3 className="w-4 h-4 mr-2" /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="budgets" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Target className="w-4 h-4 mr-2" /> Budgets
            </TabsTrigger>
            <TabsTrigger value="savings" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <PiggyBank className="w-4 h-4 mr-2" /> Épargne
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dépensé ce mois</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{totalSpent.toFixed(0)}€</div>
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                  <ArrowDownRight className="w-3 h-3 mr-1 text-green-500" />
                  <span className="text-green-500 font-bold">-8%</span>
                  <span className="ml-1">vs février</span>
                </div>
              </Card>

              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <PiggyBank className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Épargne totale</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">2 450€</div>
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                  <ArrowUpRight className="w-3 h-3 mr-1 text-green-500" />
                  <span className="text-green-500 font-bold">+400€</span>
                  <span className="ml-1">ce mois</span>
                </div>
              </Card>

              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Budget restant</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{(totalLimit - totalSpent).toFixed(0)}€</div>
                <Progress value={(totalSpent / totalLimit) * 100} className="h-1.5 mt-3" />
                <p className="text-xs text-muted-foreground mt-2">{Math.round((totalSpent / totalLimit) * 100)}% utilisé</p>
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Évolution des dépenses
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}€`} />
                    <Bar dataKey="cyclisme" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="stack" />
                    <Bar dataKey="nutrition" fill="hsl(25 95% 53%)" radius={[0, 0, 0, 0]} stackId="stack" />
                    <Bar dataKey="divers" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
              <div className="flex gap-6 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-primary" /> Cyclisme</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-orange-500" /> Nutrition</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-muted-foreground" /> Divers</span>
              </div>
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight">Dernières transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  {recentTransactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30">
                      <div className="flex-1">
                        <p className="text-sm font-bold">{tx.label}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-[10px] font-bold border-none bg-secondary px-3 mr-4">
                        {tx.category}
                      </Badge>
                      <span className={cn("font-bold text-sm", tx.amount < 0 ? "text-red-500" : "text-green-500")}>
                        {tx.amount.toFixed(2)}€
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budgets" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {budgets.map((budget) => {
                const pct = Math.round((budget.spent / budget.limit) * 100)
                const remaining = budget.limit - budget.spent
                return (
                  <Card key={budget.label} className="apple-card border-none p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", budget.bg)}>
                        <budget.icon className={cn("w-6 h-6", budget.color)} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{budget.label}</h3>
                        <p className="text-xs text-muted-foreground">{budget.limit}€ / mois</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-3xl font-bold tracking-tight">{budget.spent}€</span>
                        <span className={cn("text-sm font-bold", pct > 90 ? "text-red-500" : pct > 70 ? "text-yellow-500" : "text-green-500")}>
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {remaining > 0 ? `${remaining}€ restant` : `${Math.abs(remaining)}€ de dépassement`}
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Répartition globale</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4">
                  {budgets.map((b) => (
                    <div key={b.label} className="flex items-center gap-4">
                      <span className="text-sm font-bold w-28">{b.label}</span>
                      <div className="flex-1">
                        <Progress value={(b.spent / totalSpent) * 100} className="h-3" />
                      </div>
                      <span className="text-sm font-bold w-16 text-right">{Math.round((b.spent / totalSpent) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                    <div className="text-3xl font-bold tracking-tight">2 450€</div>
                  </div>
                </div>
                <Progress value={49} className="h-2 mt-4" />
                <p className="text-xs text-muted-foreground mt-2">49% de l'objectif (5 000€)</p>
              </Card>

              <Card className="apple-card border-none p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Bike className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Objectif</span>
                    <div className="text-3xl font-bold tracking-tight">Nouveau Vélo</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  À ce rythme, objectif atteint en <span className="font-bold text-foreground">~6 mois</span>.
                </p>
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" /> Évolution de l'épargne
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={savingsData}>
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
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
