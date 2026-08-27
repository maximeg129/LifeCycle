"use client"

// Code-split from cycling/page.tsx (see PLAN.md 2.4) — the PMC charts pull
// in Recharts' LineChart/BarChart, which only the PMC tab needs. Loaded via
// next/dynamic so visiting the (default) Entraînement tab doesn't pay for
// this chunk.

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import { Flame } from 'lucide-react'
import { NotConfiguredBanner } from './not-configured-banner'
import { PowerCurveCard } from './power-curve-card'
import type { IntervalsFitnessDay } from '@/lib/intervals-api'

const fitnessChartConfig: ChartConfig = {
  ctl: { label: 'Fitness (CTL)', color: 'hsl(230, 84%, 63%)' },
  atl: { label: 'Fatigue (ATL)', color: 'hsl(0, 84%, 63%)' },
  tsb: { label: 'Forme (TSB)', color: 'hsl(142, 71%, 45%)' },
}

const loadChartConfig: ChartConfig = {
  trainingLoad: { label: 'Charge (TSS)', color: 'hsl(230, 84%, 63%)' },
}

export interface PmcTabProps {
  isConfigured: boolean
  athleteLoading: boolean
  fitness: { data: IntervalsFitnessDay[]; isLoading: boolean }
}

export function PmcTab({ isConfigured, athleteLoading, fitness }: PmcTabProps) {
  // Chart data for PMC (sample every 3rd day for readability)
  const fitnessChartData = useMemo(() => {
    if (!fitness.data.length) return []
    return fitness.data
      .filter((_, i) => i % 3 === 0 || i === fitness.data.length - 1)
      .map(d => ({
        date: format(parseISO(d.date), 'dd/MM'),
        ctl: Math.round(d.ctl),
        atl: Math.round(d.atl),
        tsb: Math.round(d.tsb),
      }))
  }, [fitness.data])

  // Aggregate weekly load from fitness data
  const weeklyLoad = useMemo(() => {
    if (!fitness.data.length) return []
    const weeks: Record<string, number> = {}
    for (const day of fitness.data) {
      const d = parseISO(day.date)
      const dayOfWeek = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7))
      const key = format(monday, 'dd/MM')
      weeks[key] = (weeks[key] || 0) + (day.trainingLoad || 0)
    }
    return Object.entries(weeks).map(([week, load]) => ({ week, trainingLoad: Math.round(load) }))
  }, [fitness.data])

  return (
    <div className="space-y-8">
      {/* Riegel power-duration curve — independent of Intervals.icu, always available */}
      <PowerCurveCard />

      {!isConfigured && !athleteLoading ? (
        <NotConfiguredBanner />
      ) : (
        <>
          {/* PMC Line Chart */}
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle>Courbe de Performance (12 semaines)</CardTitle>
            </CardHeader>
            <CardContent>
              {fitness.isLoading ? (
                <Skeleton className="h-[300px] w-full rounded-lg" />
              ) : fitnessChartData.length > 0 ? (
                <ChartContainer config={fitnessChartConfig} className="h-[300px] w-full">
                  <LineChart data={fitnessChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="ctl" stroke="var(--color-ctl)" strokeWidth={2} dot={false} name="CTL" />
                    <Line type="monotone" dataKey="atl" stroke="var(--color-atl)" strokeWidth={2} dot={false} name="ATL" />
                    <Line type="monotone" dataKey="tsb" stroke="var(--color-tsb)" strokeWidth={2} dot={false} name="TSB" />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  Aucune donnée fitness disponible
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Load Bar Chart */}
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" /> Charge hebdomadaire (TSS)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fitness.isLoading ? (
                <Skeleton className="h-[200px] w-full rounded-lg" />
              ) : weeklyLoad.length > 0 ? (
                <ChartContainer config={loadChartConfig} className="h-[200px] w-full">
                  <BarChart data={weeklyLoad}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="trainingLoad" fill="var(--color-trainingLoad)" radius={[4, 4, 0, 0]} name="TSS" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                  Aucune donnée de charge disponible
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
