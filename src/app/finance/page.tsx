"use client"

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, PieChart } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from 'recharts'

const data = [
  { month: 'Jan', exp: 2400 },
  { month: 'Fév', exp: 1398 },
  { month: 'Mar', exp: 9800 },
  { month: 'Avr', exp: 3908 },
  { month: 'Mai', exp: 4800 },
]

export default function FinancePage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-8 h-8 text-accent" /> LifeCycle Finance
          </h1>
          <p className="text-muted-foreground">Suivi des budgets et dépenses liées au style de vie.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase">Budget Cyclisme (Mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">145.00€ / 200€</div>
              <div className="flex items-center text-xs text-red-500 mt-2">
                <ArrowUpRight className="w-3 h-3 mr-1" /> +12% vs avril
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase">Dépenses Alimentation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">420.50€</div>
              <div className="flex items-center text-xs text-accent mt-2">
                <ArrowDownRight className="w-3 h-3 mr-1" /> Stable
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase">Épargne Projets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">2,450€</div>
              <div className="flex items-center text-xs text-accent mt-2">
                <TrendingUp className="w-3 h-3 mr-1" /> Objectif : Nouveau Vélo
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/40 border-border">
          <CardHeader>
            <CardTitle>Évolution des Dépenses Lifestyle</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}€`} />
                <Bar dataKey="exp" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
