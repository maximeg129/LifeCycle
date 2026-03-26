"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  HeartPulse,
  Moon,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Brain,
  Weight,
  AlertTriangle,
  Settings,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Line, LineChart, XAxis, YAxis, ResponsiveContainer, Area, AreaChart,
  CartesianGrid, Bar, BarChart, ComposedChart,
  ScatterChart, Scatter, ZAxis, Tooltip, Cell,
} from 'recharts'
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import Link from 'next/link'
import { useWellness, useAthlete } from '@/hooks/use-intervals'
import type { IntervalsWellness } from '@/lib/intervals-api'
import { recoveryRecommendation } from '@/ai/flows/recovery-recommendation-flow'

// ── Date ranges ──────────────────────────────────────────────────────
const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest7 = format(subDays(today, 7), 'yyyy-MM-dd')
const oldest30 = format(subDays(today, 30), 'yyyy-MM-dd')

// ── Helpers ──────────────────────────────────────────────────────────

function formatSleepDuration(secs: number | undefined | null): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

function avg(values: (number | undefined | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null && !isNaN(v))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function trend7vs30(data7: number | null, data30: number | null): { delta: number; isUp: boolean } | null {
  if (data7 == null || data30 == null || data30 === 0) return null
  const delta = ((data7 - data30) / data30) * 100
  return { delta: Math.round(delta), isUp: delta > 0 }
}

function readinessColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-yellow-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

function readinessLabel(score: number | null): string {
  if (score == null) return 'Indisponible'
  if (score >= 80) return 'Prêt pour l\'effort'
  if (score >= 60) return 'Récupération correcte'
  if (score >= 40) return 'Fatigue modérée'
  return 'Repos recommandé'
}

interface OvertrainingAlert {
  type: 'warning' | 'danger' | 'info'
  title: string
  message: string
}

function detectOvertrainingAlerts(data: IntervalsWellness[]): OvertrainingAlert[] {
  const alerts: OvertrainingAlert[] = []
  if (data.length < 3) return alerts

  const recent = data.slice(-7)

  // HRV declining trend
  const hrvValues = recent.map(d => d.hrv).filter((v): v is number => v != null)
  if (hrvValues.length >= 5) {
    const firstHalf = avg(hrvValues.slice(0, Math.floor(hrvValues.length / 2)))
    const secondHalf = avg(hrvValues.slice(Math.floor(hrvValues.length / 2)))
    if (firstHalf && secondHalf && secondHalf < firstHalf * 0.9) {
      alerts.push({
        type: 'warning',
        title: 'HRV en baisse',
        message: `Votre HRV a chuté de ${Math.round(((firstHalf - secondHalf) / firstHalf) * 100)}% sur les 7 derniers jours. Pensez à réduire l'intensité.`,
      })
    }
  }

  // Resting HR rising
  const rhrValues = recent.map(d => d.restingHR).filter((v): v is number => v != null)
  if (rhrValues.length >= 5) {
    const baseline = avg(rhrValues.slice(0, 3))
    const current = avg(rhrValues.slice(-3))
    if (baseline && current && current > baseline + 5) {
      alerts.push({
        type: 'danger',
        title: 'FC repos en hausse',
        message: `+${Math.round(current - baseline)} bpm vs votre baseline. Signal de fatigue ou maladie.`,
      })
    }
  }

  // Poor sleep streak
  const sleepValues = recent.map(d => d.sleepSecs).filter((v): v is number => v != null)
  const poorSleepStreak = sleepValues.filter(s => s < 6 * 3600).length
  if (poorSleepStreak >= 3) {
    alerts.push({
      type: 'danger',
      title: 'Déficit de sommeil',
      message: `${poorSleepStreak} nuits sous 6h cette semaine. La récupération est compromise.`,
    })
  }

  // Ramp rate too high
  const rampRates = recent.map(d => d.rampRate).filter((v): v is number => v != null)
  const lastRamp = rampRates[rampRates.length - 1]
  if (lastRamp != null && lastRamp > 8) {
    alerts.push({
      type: 'warning',
      title: 'Montée en charge rapide',
      message: `Ramp rate à ${lastRamp.toFixed(1)} TSS/j — risque de blessure si maintenu. Seuil recommandé : <8.`,
    })
  }

  // Good news
  if (alerts.length === 0 && hrvValues.length >= 3) {
    const avgHrv = avg(hrvValues)
    if (avgHrv && avgHrv > 60) {
      alerts.push({
        type: 'info',
        title: 'Bonne récupération',
        message: 'Vos indicateurs sont stables. Vous pouvez maintenir votre charge d\'entraînement.',
      })
    }
  }

  return alerts
}

// ── Chart configs ────────────────────────────────────────────────────

const hrvChartConfig: ChartConfig = {
  hrv: { label: 'HRV (ms)', color: 'hsl(0, 84%, 63%)' },
}

const sleepChartConfig: ChartConfig = {
  hours: { label: 'Sommeil (h)', color: 'hsl(240, 60%, 60%)' },
  score: { label: 'Score (%)', color: 'hsl(142, 71%, 45%)' },
}

const rhrChartConfig: ChartConfig = {
  restingHR: { label: 'FC repos (bpm)', color: 'hsl(340, 80%, 55%)' },
}

const correlationChartConfig: ChartConfig = {
  hrv: { label: 'HRV (ms)', color: 'hsl(0, 84%, 63%)' },
  ctl: { label: 'Fitness (CTL)', color: 'hsl(230, 84%, 63%)' },
  atl: { label: 'Fatigue (ATL)', color: 'hsl(40, 90%, 55%)' },
}

const weightChartConfig: ChartConfig = {
  weight: { label: 'Poids (kg)', color: 'hsl(260, 60%, 60%)' },
}

// ── Recovery Score ───────────────────────────────────────────────────

interface RecoveryScoreResult {
  score: number
  components: {
    hrv: { score: number; weight: number; available: boolean }
    sleep: { score: number; weight: number; available: boolean }
    rhr: { score: number; weight: number; available: boolean }
    mood: { score: number; weight: number; available: boolean }
  }
  label: string
  color: string
}

function computeRecoveryScore(
  wellness7: IntervalsWellness[],
  avg30Hrv: number | null,
  avg30Rhr: number | null,
): RecoveryScoreResult | null {
  if (wellness7.length === 0) return null

  const recent = wellness7.slice(-3) // last 3 days for freshness

  // HRV component (40%): compare recent avg to 30-day baseline
  const recentHrv = avg(recent.map(d => d.hrv))
  let hrvScore = 50
  let hrvAvailable = false
  if (recentHrv != null && avg30Hrv != null && avg30Hrv > 0) {
    hrvAvailable = true
    const ratio = recentHrv / avg30Hrv
    // ratio 1.0 = 75/100, 0.85 = 50, 1.15 = 100, 0.7 = 25
    hrvScore = Math.max(0, Math.min(100, 75 + (ratio - 1) * 166))
  }

  // Sleep component (30%): based on average hours + score
  const recentSleepHours = avg(recent.map(d => d.sleepSecs ? d.sleepSecs / 3600 : null))
  const recentSleepScore = avg(recent.map(d => d.sleepScore ?? d.sleepQuality))
  let sleepScore = 50
  let sleepAvailable = false
  if (recentSleepHours != null) {
    sleepAvailable = true
    // 8h = 100, 7h = 75, 6h = 50, 5h = 25
    const hoursScore = Math.max(0, Math.min(100, (recentSleepHours - 4) * 25))
    sleepScore = recentSleepScore != null ? (hoursScore * 0.5 + recentSleepScore * 0.5) : hoursScore
  }

  // Resting HR component (20%): lower is better relative to baseline
  const recentRhr = avg(recent.map(d => d.restingHR))
  let rhrScore = 50
  let rhrAvailable = false
  if (recentRhr != null && avg30Rhr != null && avg30Rhr > 0) {
    rhrAvailable = true
    const ratio = recentRhr / avg30Rhr
    // ratio 1.0 = 75, 1.1 = 50, 0.9 = 100, 1.2 = 25
    rhrScore = Math.max(0, Math.min(100, 75 - (ratio - 1) * 250))
  }

  // Mood component (10%): direct from 1-5 scale
  const recentMood = avg(recent.map(d => d.mood))
  let moodScore = 50
  let moodAvailable = false
  if (recentMood != null) {
    moodAvailable = true
    moodScore = (recentMood / 5) * 100
  }

  // Weighted average with dynamic weights if some data missing
  const components = [
    { score: hrvScore, baseWeight: 0.4, available: hrvAvailable },
    { score: sleepScore, baseWeight: 0.3, available: sleepAvailable },
    { score: rhrScore, baseWeight: 0.2, available: rhrAvailable },
    { score: moodScore, baseWeight: 0.1, available: moodAvailable },
  ]
  const availableComponents = components.filter(c => c.available)
  if (availableComponents.length === 0) return null

  const totalWeight = availableComponents.reduce((sum, c) => sum + c.baseWeight, 0)
  const score = Math.round(
    availableComponents.reduce((sum, c) => sum + (c.score * c.baseWeight / totalWeight), 0)
  )

  const label = score >= 80 ? 'Excellente' : score >= 65 ? 'Bonne' : score >= 45 ? 'Modérée' : 'Faible'
  const color = score >= 80 ? 'text-green-500' : score >= 65 ? 'text-blue-500' : score >= 45 ? 'text-yellow-500' : 'text-red-500'

  return {
    score,
    components: {
      hrv: { score: Math.round(hrvScore), weight: 40, available: hrvAvailable },
      sleep: { score: Math.round(sleepScore), weight: 30, available: sleepAvailable },
      rhr: { score: Math.round(rhrScore), weight: 20, available: rhrAvailable },
      mood: { score: Math.round(moodScore), weight: 10, available: moodAvailable },
    },
    label,
    color,
  }
}

// ── Scatter plot colors ──────────────────────────────────────────────

function scatterPointColor(hrv: number, avgHrv: number): string {
  const ratio = hrv / avgHrv
  if (ratio >= 1.05) return 'hsl(142, 71%, 45%)' // green — recovered
  if (ratio >= 0.9) return 'hsl(230, 84%, 63%)' // blue — normal
  if (ratio >= 0.8) return 'hsl(40, 90%, 55%)' // yellow — caution
  return 'hsl(0, 84%, 63%)' // red — fatigued
}

// ── AI Recommendation type ───────────────────────────────────────────

type AIRecommendation = {
  readinessLevel: 'high' | 'moderate' | 'low' | 'rest'
  summary: string
  trainingRecommendation: string
  recoveryTips: string[]
  alerts: { type: 'warning' | 'danger' | 'info'; message: string }[]
} | null

// ── Not configured banner ────────────────────────────────────────────

function NotConfiguredBanner() {
  return (
    <Card className="bg-card/40 border-border border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <AlertTriangle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Intervals.icu non connecté</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Configurez votre ID Athlète et clé API dans les réglages pour synchroniser vos données de bien-être.
        </p>
        <Link href="/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" /> Configurer Intervals.icu
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

function MetricSkeleton() {
  return (
    <Card className="apple-card border-none p-6">
      <Skeleton className="h-10 w-10 rounded-2xl mb-4" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </Card>
  )
}

// ── Main page ────────────────────────────────────────────────────────

export default function LifestylePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [aiRec, setAiRec] = useState<AIRecommendation>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const athlete = useAthlete()
  const wellness30 = useWellness(oldest30, newest)
  const isConfigured = athlete.isConfigured

  // ── Derived data ─────────────────────────────────────────────────
  const wellness7 = useMemo(() => {
    if (!wellness30.data.length) return []
    return wellness30.data.filter(d => d.id >= oldest7)
  }, [wellness30.data])

  const latestDay = useMemo(() => {
    if (!wellness7.length) return null
    return wellness7[wellness7.length - 1]
  }, [wellness7])

  // Find the most recent value for each metric (not all fields are filled every day)
  const latestHrv = useMemo(() => {
    for (let i = wellness7.length - 1; i >= 0; i--) {
      if (wellness7[i].hrv != null) return wellness7[i].hrv
    }
    return null
  }, [wellness7])

  const latestSleepSecs = useMemo(() => {
    for (let i = wellness7.length - 1; i >= 0; i--) {
      if (wellness7[i].sleepSecs != null) return wellness7[i].sleepSecs
    }
    return null
  }, [wellness7])

  const latestSleepScore = useMemo(() => {
    for (let i = wellness7.length - 1; i >= 0; i--) {
      const s = wellness7[i].sleepScore ?? wellness7[i].sleepQuality
      if (s != null) return s
    }
    return null
  }, [wellness7])

  const latestReadiness = useMemo(() => {
    for (let i = wellness7.length - 1; i >= 0; i--) {
      if (wellness7[i].readiness != null) return wellness7[i].readiness
    }
    return null
  }, [wellness7])

  const latestRhr = useMemo(() => {
    for (let i = wellness7.length - 1; i >= 0; i--) {
      if (wellness7[i].restingHR != null) return wellness7[i].restingHR
    }
    return null
  }, [wellness7])

  // Averages
  const avg7Hrv = useMemo(() => avg(wellness7.map(d => d.hrv)), [wellness7])
  const avg30Hrv = useMemo(() => avg(wellness30.data.map(d => d.hrv)), [wellness30.data])
  const avg7Sleep = useMemo(() => avg(wellness7.map(d => d.sleepSecs ? d.sleepSecs / 3600 : null)), [wellness7])
  const avg7Rhr = useMemo(() => avg(wellness7.map(d => d.restingHR)), [wellness7])
  const avg30Rhr = useMemo(() => avg(wellness30.data.map(d => d.restingHR)), [wellness30.data])

  // Overtraining alerts
  const alerts = useMemo(() => detectOvertrainingAlerts(wellness7), [wellness7])

  // HRV chart data (30 days)
  const hrvChartData = useMemo(() => {
    return wellness30.data
      .filter(d => d.hrv != null)
      .map(d => ({
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
        hrv: d.hrv,
      }))
  }, [wellness30.data])

  // Sleep chart data (30 days)
  const sleepChartData = useMemo(() => {
    return wellness30.data
      .filter(d => d.sleepSecs != null)
      .map(d => ({
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
        hours: d.sleepSecs ? Math.round((d.sleepSecs / 3600) * 10) / 10 : 0,
        score: d.sleepScore ?? d.sleepQuality ?? null,
      }))
  }, [wellness30.data])

  // RHR chart data (30 days)
  const rhrChartData = useMemo(() => {
    return wellness30.data
      .filter(d => d.restingHR != null)
      .map(d => ({
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
        restingHR: d.restingHR,
      }))
  }, [wellness30.data])

  // Correlation chart data: CTL/ATL vs HRV (30 days)
  const correlationData = useMemo(() => {
    return wellness30.data
      .filter(d => d.hrv != null || d.ctl != null)
      .map(d => ({
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
        hrv: d.hrv ?? null,
        ctl: d.ctl ?? null,
        atl: d.atl ?? null,
      }))
  }, [wellness30.data])

  // Weight chart data (30 days)
  const weightChartData = useMemo(() => {
    return wellness30.data
      .filter(d => d.weight != null)
      .map(d => ({
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
        weight: d.weight,
      }))
  }, [wellness30.data])

  // Sleep detail (7 days)
  const sleepDetail = useMemo(() => {
    return wellness7
      .filter(d => d.sleepSecs != null)
      .map(d => ({
        date: format(parseISO(d.id), 'EEE dd/MM', { locale: fr }),
        hours: d.sleepSecs ? Math.round((d.sleepSecs / 3600) * 10) / 10 : 0,
        score: d.sleepScore ?? d.sleepQuality ?? null,
      }))
  }, [wellness7])

  // Latest weight & W/kg
  const latestWeight = useMemo(() => {
    const withWeight = wellness30.data.filter(d => d.weight != null)
    return withWeight.length ? withWeight[withWeight.length - 1].weight : null
  }, [wellness30.data])

  const wPerKg = useMemo(() => {
    if (!athlete.data?.ftp || !latestWeight) return null
    return (athlete.data.ftp / latestWeight).toFixed(2)
  }, [athlete.data?.ftp, latestWeight])

  // Recovery Score
  const recoveryScore = useMemo(() => {
    return computeRecoveryScore(wellness7, avg30Hrv, avg30Rhr)
  }, [wellness7, avg30Hrv, avg30Rhr])

  // Scatter plot data: CTL vs HRV (30 days)
  const scatterData = useMemo(() => {
    return wellness30.data
      .filter(d => d.ctl != null && d.hrv != null)
      .map(d => ({
        ctl: Math.round(d.ctl!),
        hrv: Math.round(d.hrv!),
        date: format(parseISO(d.id), 'dd/MM', { locale: fr }),
      }))
  }, [wellness30.data])

  // AI recommendation
  const fetchAiRecommendation = useCallback(async () => {
    if (!wellness7.length) return
    setAiLoading(true)
    try {
      const input = {
        wellnessData: wellness7.map(d => ({
          date: d.id,
          hrv: d.hrv ?? null,
          restingHR: d.restingHR ?? null,
          sleepHours: d.sleepSecs ? d.sleepSecs / 3600 : null,
          sleepScore: d.sleepScore ?? d.sleepQuality ?? null,
          readiness: d.readiness ?? null,
          fatigue: d.fatigue ?? null,
          mood: d.mood ?? null,
          motivation: d.motivation ?? null,
          ctl: d.ctl ?? null,
          atl: d.atl ?? null,
          rampRate: d.rampRate ?? null,
          weight: d.weight ?? null,
        })),
        ftp: athlete.data?.ftp ?? null,
      }
      const result = await recoveryRecommendation(input)
      setAiRec(result)
    } catch {
      setAiRec(null)
    } finally {
      setAiLoading(false)
    }
  }, [wellness7, athlete.data?.ftp])

  const isLoading = wellness30.isLoading || athlete.isLoading

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Bien-être</h2>
            <h1 className="text-3xl font-bold">Vie & Santé</h1>
          </div>
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted gap-2 w-fit"
              onClick={() => wellness30.refresh()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Synchroniser
            </Button>
          )}
        </header>

        {!isConfigured && !athlete.isLoading ? (
          <NotConfiguredBanner />
        ) : (
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
              <TabsTrigger value="overview" className="px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
                <Zap className="w-4 h-4 mr-2" /> Vue d&apos;ensemble
              </TabsTrigger>
              <TabsTrigger value="sleep" className="px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
                <Moon className="w-4 h-4 mr-2" /> Sommeil
              </TabsTrigger>
              <TabsTrigger value="recovery" className="px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
                <Activity className="w-4 h-4 mr-2" /> Récupération
              </TabsTrigger>
              <TabsTrigger value="weight" className="px-6 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
                <Weight className="w-4 h-4 mr-2" /> Poids
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Vue d'ensemble ── */}
            <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
              {/* Recovery Score */}
              {!isLoading && recoveryScore && (
                <Card className="apple-card border-none p-8">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* Big score circle */}
                    <div className="relative w-40 h-40 shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="8" opacity="0.3" />
                        <circle
                          cx="60" cy="60" r="52" fill="none"
                          stroke={recoveryScore.score >= 80 ? 'hsl(142, 71%, 45%)' : recoveryScore.score >= 65 ? 'hsl(230, 84%, 63%)' : recoveryScore.score >= 45 ? 'hsl(40, 90%, 55%)' : 'hsl(0, 84%, 63%)'}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${(recoveryScore.score / 100) * 327} 327`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={cn("text-4xl font-bold", recoveryScore.color)}>{recoveryScore.score}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recovery</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="flex-1 w-full space-y-4">
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Recovery Score</h3>
                        <p className="text-sm text-muted-foreground">
                          Récupération <span className={cn("font-bold", recoveryScore.color)}>{recoveryScore.label.toLowerCase()}</span> — basée sur les 3 derniers jours
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {([
                          { key: 'hrv' as const, label: 'HRV', icon: Activity, iconColor: 'text-red-500' },
                          { key: 'sleep' as const, label: 'Sommeil', icon: Moon, iconColor: 'text-indigo-500' },
                          { key: 'rhr' as const, label: 'FC repos', icon: HeartPulse, iconColor: 'text-pink-500' },
                          { key: 'mood' as const, label: 'Humeur', icon: Brain, iconColor: 'text-primary' },
                        ]).map(({ key, label, icon: Icon, iconColor }) => {
                          const comp = recoveryScore.components[key]
                          return (
                            <div key={key} className={cn("p-3 rounded-xl", comp.available ? "bg-secondary/40" : "bg-secondary/20 opacity-50")}>
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className={cn("w-3.5 h-3.5", iconColor)} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                              </div>
                              <div className="flex items-end justify-between">
                                <span className="text-lg font-bold">{comp.available ? comp.score : '—'}</span>
                                <span className="text-[10px] text-muted-foreground">{comp.weight}%</span>
                              </div>
                              <Progress value={comp.available ? comp.score : 0} className="h-1 mt-1.5" />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? (
                  <>
                    <MetricSkeleton />
                    <MetricSkeleton />
                    <MetricSkeleton />
                    <MetricSkeleton />
                  </>
                ) : (
                  <>
                    {/* HRV */}
                    <Card className="apple-card border-none p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-red-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">HRV</span>
                      </div>
                      <div className="text-3xl font-bold tracking-tight mb-1">
                        {latestHrv != null ? `${Math.round(latestHrv)} ms` : '—'}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        {avg7Hrv != null ? `Moy. 7j : ${Math.round(avg7Hrv)} ms` : 'Aucune donnée'}
                        {(() => {
                          const t = trend7vs30(avg7Hrv, avg30Hrv)
                          if (!t) return null
                          return (
                            <span className={cn("ml-2", t.isUp ? "text-green-500" : "text-red-500")}>
                              {t.isUp ? '+' : ''}{t.delta}%
                            </span>
                          )
                        })()}
                      </p>
                      <Progress value={latestHrv ? Math.min(100, (latestHrv / 100) * 100) : 0} className="h-1.5" />
                    </Card>

                    {/* Sommeil */}
                    <Card className="apple-card border-none p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                          <Moon className="w-5 h-5 text-indigo-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sommeil</span>
                      </div>
                      <div className="text-3xl font-bold tracking-tight mb-1">
                        {formatSleepDuration(latestSleepSecs)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        {avg7Sleep != null ? `Moy. 7j : ${avg7Sleep.toFixed(1)}h` : 'Aucune donnée'}
                        {latestSleepScore != null && (
                          <span className="ml-2">Score : {latestSleepScore}%</span>
                        )}
                      </p>
                      <Progress value={latestSleepScore ?? (latestSleepSecs ? Math.min(100, (latestSleepSecs / 28800) * 100) : 0)} className="h-1.5" />
                    </Card>

                    {/* Readiness */}
                    <Card className="apple-card border-none p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Readiness</span>
                      </div>
                      <div className={cn("text-3xl font-bold tracking-tight mb-1", readinessColor(latestReadiness ?? null))}>
                        {latestReadiness != null ? `${latestReadiness}/100` : '—'}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        {readinessLabel(latestReadiness ?? null)}
                      </p>
                      <Progress value={latestReadiness ?? 0} className="h-1.5" />
                    </Card>

                    {/* FC repos */}
                    <Card className="apple-card border-none p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-pink-500/10 flex items-center justify-center">
                          <HeartPulse className="w-5 h-5 text-pink-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">FC Repos</span>
                      </div>
                      <div className="text-3xl font-bold tracking-tight mb-1">
                        {latestRhr != null ? `${latestRhr} bpm` : '—'}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        {avg7Rhr != null ? `Moy. 7j : ${Math.round(avg7Rhr)} bpm` : 'Aucune donnée'}
                        {(() => {
                          const t = trend7vs30(avg7Rhr, avg30Rhr)
                          if (!t) return null
                          return (
                            <span className={cn("ml-2", t.isUp ? "text-red-500" : "text-green-500")}>
                              {t.isUp ? '+' : ''}{t.delta}%
                            </span>
                          )
                        })()}
                      </p>
                      <Progress value={latestRhr ? Math.min(100, ((100 - latestRhr) / 60) * 100) : 0} className="h-1.5" />
                    </Card>
                  </>
                )}
              </div>

              {/* Alertes surentraînement */}
              {alerts.length > 0 && (
                <div className="space-y-3">
                  {alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-4 rounded-2xl border flex items-start gap-3",
                        alert.type === 'danger' && "bg-red-500/5 border-red-500/20",
                        alert.type === 'warning' && "bg-yellow-500/5 border-yellow-500/20",
                        alert.type === 'info' && "bg-green-500/5 border-green-500/20",
                      )}
                    >
                      <AlertTriangle className={cn(
                        "w-5 h-5 mt-0.5 shrink-0",
                        alert.type === 'danger' && "text-red-500",
                        alert.type === 'warning' && "text-yellow-500",
                        alert.type === 'info' && "text-green-500",
                      )} />
                      <div>
                        <h4 className="font-bold text-sm">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Graphiques humeur + HRV rapide */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="apple-card border-none p-8">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary" /> Humeur & Motivation
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Ressenti subjectif sur les 7 derniers jours. Une baisse combinée humeur + motivation est un signal précoce de surentraînement.</p>
                  </CardHeader>
                  <CardContent className="p-0 h-[200px]">
                    {wellness7.some(d => d.mood != null) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wellness7.filter(d => d.mood != null || d.motivation != null).map(d => ({
                          day: format(parseISO(d.id), 'EEE', { locale: fr }),
                          mood: d.mood,
                          motivation: d.motivation,
                        }))}>
                          <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis domain={[0, 5]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <Bar dataKey="mood" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Humeur" />
                          <Bar dataKey="motivation" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Motivation" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée d&apos;humeur disponible
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="apple-card border-none p-8">
                  <CardHeader className="p-0 mb-6">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Activity className="w-5 h-5 text-red-500" /> HRV — 7 derniers jours
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Variabilité cardiaque : le meilleur indicateur de récupération du système nerveux autonome. Plus c&apos;est haut, mieux vous récupérez.</p>
                  </CardHeader>
                  <CardContent className="p-0 h-[200px]">
                    {wellness7.some(d => d.hrv != null) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={wellness7.filter(d => d.hrv != null).map(d => ({
                          day: format(parseISO(d.id), 'EEE', { locale: fr }),
                          hrv: d.hrv,
                        }))}>
                          <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis domain={[(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v)}ms`} />
                          <Line type="monotone" dataKey="hrv" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ fill: "hsl(0 84% 60%)", r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée HRV disponible
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Conseils IA */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" /> Analyse IA de votre récupération
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAiRecommendation}
                      disabled={aiLoading || !wellness7.length}
                      className="gap-2"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {aiRec ? 'Actualiser' : 'Analyser'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {aiLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : aiRec ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <Badge className={cn(
                          "rounded-full px-4 py-1.5 text-xs font-bold border-none",
                          aiRec.readinessLevel === 'high' && "bg-green-500/10 text-green-500",
                          aiRec.readinessLevel === 'moderate' && "bg-yellow-500/10 text-yellow-500",
                          aiRec.readinessLevel === 'low' && "bg-orange-500/10 text-orange-500",
                          aiRec.readinessLevel === 'rest' && "bg-red-500/10 text-red-500",
                        )}>
                          {aiRec.readinessLevel === 'high' && 'Prêt'}
                          {aiRec.readinessLevel === 'moderate' && 'Modéré'}
                          {aiRec.readinessLevel === 'low' && 'Fatigué'}
                          {aiRec.readinessLevel === 'rest' && 'Repos'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{aiRec.summary}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                          <h5 className="font-bold text-sm text-primary flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Entraînement recommandé
                          </h5>
                          <p className="text-xs text-muted-foreground leading-relaxed">{aiRec.trainingRecommendation}</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-green-500/5 border border-green-500/20 space-y-2">
                          <h5 className="font-bold text-sm text-green-600 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Conseils récupération
                          </h5>
                          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                            {aiRec.recoveryTips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {aiRec.alerts.length > 0 && (
                        <div className="space-y-2">
                          {aiRec.alerts.map((alert, i) => (
                            <div key={i} className={cn(
                              "p-3 rounded-xl text-xs flex items-start gap-2",
                              alert.type === 'danger' && "bg-red-500/5 text-red-500",
                              alert.type === 'warning' && "bg-yellow-500/5 text-yellow-500",
                              alert.type === 'info' && "bg-green-500/5 text-green-500",
                            )}>
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              {alert.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Cliquez sur &laquo; Analyser &raquo; pour obtenir une recommandation personnalisée basée sur vos données des 7 derniers jours.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Sommeil ── */}
            <TabsContent value="sleep" className="space-y-8 animate-in fade-in duration-500">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-indigo-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Moyenne 7j</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {avg7Sleep != null ? `${Math.floor(avg7Sleep)}h${Math.round((avg7Sleep % 1) * 60).toString().padStart(2, '0')}` : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">par nuit</p>
                </Card>
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Score moyen</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {(() => {
                      const scores = wellness7.map(d => d.sleepScore ?? d.sleepQuality).filter((v): v is number => v != null)
                      const a = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
                      return a != null ? `${a}%` : '—'
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">qualité de sommeil</p>
                </Card>
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dernière nuit</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {formatSleepDuration(latestSleepSecs)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {latestSleepScore != null ? `Score : ${latestSleepScore}%` : ''}
                  </p>
                </Card>
              </div>

              {/* Sleep chart 30j */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Moon className="w-5 h-5 text-indigo-500" /> Durée de sommeil — 30 jours
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Un cycliste a besoin de 7-9h de sommeil pour une adaptation optimale à l&apos;entraînement. Sous 6h, la synthèse protéique et la sécrétion d&apos;hormone de croissance sont réduites.</p>
                </CardHeader>
                <CardContent className="p-0 h-[280px]">
                  {sleepChartData.length > 0 ? (
                    <ChartContainer config={sleepChartConfig} className="h-full w-full">
                      <AreaChart data={sleepChartData}>
                        <defs>
                          <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(240 60% 60%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(240 60% 60%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}h`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="hours" stroke="var(--color-hours)" fill="url(#sleepGradient)" strokeWidth={2} name="Sommeil" />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée de sommeil disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detail per night */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-lg font-bold tracking-tight">Détail par nuit — 7 jours</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {sleepDetail.length > 0 ? (
                    <div className="space-y-3">
                      {sleepDetail.map((night) => (
                        <div key={night.date} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30">
                          <span className="font-bold text-sm w-24 capitalize">{night.date}</span>
                          <div className="flex-1 mx-6">
                            <Progress value={night.score ?? Math.min(100, (night.hours / 8) * 100)} className="h-2" />
                          </div>
                          <span className="text-sm font-bold w-16 text-right">{night.hours}h</span>
                          {night.score != null && (
                            <Badge variant="outline" className={cn(
                              "ml-4 rounded-full text-[10px] font-bold border-none px-3",
                              night.score >= 85 ? "bg-green-500/10 text-green-500" :
                              night.score >= 70 ? "bg-yellow-500/10 text-yellow-500" :
                              "bg-red-500/10 text-red-500"
                            )}>
                              {night.score}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Aucune donnée de sommeil sur les 7 derniers jours
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Récupération ── */}
            <TabsContent value="recovery" className="space-y-8 animate-in fade-in duration-500">
              {/* HRV 30 jours */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-500" /> Variabilité cardiaque (HRV) — 30 jours
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Tendance long terme de votre HRV. Une baisse progressive sur plusieurs semaines indique une accumulation de fatigue. La valeur absolue importe moins que la tendance.</p>
                </CardHeader>
                <CardContent className="p-0 h-[280px]">
                  {hrvChartData.length > 0 ? (
                    <ChartContainer config={hrvChartConfig} className="h-full w-full">
                      <LineChart data={hrvChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[(min: number) => Math.floor(min - 10), (max: number) => Math.ceil(max + 10)]} stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v)}ms`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="hrv" stroke="var(--color-hrv)" strokeWidth={2} dot={{ fill: "var(--color-hrv)", r: 3 }} name="HRV" />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée HRV disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* FC repos 30 jours */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-pink-500" /> FC repos — 30 jours
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Une hausse de +5 bpm sur plusieurs jours par rapport à votre baseline signale une fatigue accumulée ou un début de maladie. En phase de forme, la FC repos baisse naturellement.</p>
                </CardHeader>
                <CardContent className="p-0 h-[280px]">
                  {rhrChartData.length > 0 ? (
                    <ChartContainer config={rhrChartConfig} className="h-full w-full">
                      <LineChart data={rhrChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[(min: number) => Math.floor(min - 5), (max: number) => Math.ceil(max + 5)]} stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v)}bpm`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="restingHR" stroke="var(--color-restingHR)" strokeWidth={2} dot={{ fill: "var(--color-restingHR)", r: 3 }} name="FC repos" />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée FC repos disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Corrélation Charge vs HRV */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" /> Charge d&apos;entraînement vs Récupération
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Croisement CTL/ATL avec HRV sur 30 jours — identifiez si la charge impacte votre récupération
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0 h-[300px]">
                  {correlationData.length > 0 ? (
                    <ChartContainer config={correlationChartConfig} className="h-full w-full">
                      <ComposedChart data={correlationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}ms`} />
                        <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line yAxisId="left" type="monotone" dataKey="hrv" stroke="var(--color-hrv)" strokeWidth={2.5} dot={false} name="HRV" />
                        <Line yAxisId="right" type="monotone" dataKey="ctl" stroke="var(--color-ctl)" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name="CTL" />
                        <Line yAxisId="right" type="monotone" dataKey="atl" stroke="var(--color-atl)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="ATL" />
                      </ComposedChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée disponible pour la corrélation
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scatter plot CTL vs HRV — sweet spot */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <div>
                    <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Sweet Spot : Charge vs HRV
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chaque point = 1 jour. Identifiez la charge optimale où votre HRV reste stable.
                      <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Récupéré</span>
                      <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Normal</span>
                      <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Attention</span>
                      <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Fatigué</span>
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0 h-[320px]">
                  {scatterData.length >= 3 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          type="number" dataKey="ctl" name="CTL (Fitness)"
                          stroke="#888888" fontSize={11} tickLine={false}
                          label={{ value: 'CTL (Fitness)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#888888' }}
                        />
                        <YAxis
                          type="number" dataKey="hrv" name="HRV (ms)"
                          stroke="#888888" fontSize={11} tickLine={false}
                          label={{ value: 'HRV (ms)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11, fill: '#888888' }}
                        />
                        <ZAxis range={[60, 60]} />
                        <Tooltip
                          content={({ payload }: { payload?: Array<{ payload: { date: string; ctl: number; hrv: number } }> }) => {
                            if (!payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
                                <p className="font-bold">{d.date}</p>
                                <p className="text-muted-foreground">CTL : {d.ctl} — HRV : {d.hrv} ms</p>
                              </div>
                            )
                          }}
                        />
                        <Scatter data={scatterData}>
                          {scatterData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={scatterPointColor(entry.hrv, avg30Hrv ?? entry.hrv)}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Pas assez de données (minimum 3 jours avec CTL et HRV)
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ramp rate info */}
              {latestDay?.rampRate != null && (
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        latestDay.rampRate <= 5 ? "bg-green-500/10" :
                        latestDay.rampRate <= 8 ? "bg-yellow-500/10" :
                        "bg-red-500/10"
                      )}>
                        <TrendingUp className={cn(
                          "w-6 h-6",
                          latestDay.rampRate <= 5 ? "text-green-500" :
                          latestDay.rampRate <= 8 ? "text-yellow-500" :
                          "text-red-500"
                        )} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Ramp Rate</h4>
                        <p className="text-xs text-muted-foreground">Vitesse de montée en charge</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-2xl font-bold",
                        latestDay.rampRate <= 5 ? "text-green-500" :
                        latestDay.rampRate <= 8 ? "text-yellow-500" :
                        "text-red-500"
                      )}>
                        {latestDay.rampRate.toFixed(1)}
                      </div>
                      <p className="text-xs text-muted-foreground">TSS/jour</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Conservateur</span>
                      <span>Optimal</span>
                      <span>Agressif</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: '33%' }} />
                      <div className="bg-yellow-500 h-full" style={{ width: '34%' }} />
                      <div className="bg-red-500 h-full" style={{ width: '33%' }} />
                    </div>
                    <div className="relative h-4">
                      <div
                        className="absolute top-0 w-0.5 h-4 bg-foreground"
                        style={{ left: `${Math.min(100, (latestDay.rampRate / 12) * 100)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* ── Tab: Poids & Performance ── */}
            <TabsContent value="weight" className="space-y-8 animate-in fade-in duration-500">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                      <Weight className="w-5 h-5 text-purple-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Poids actuel</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const weights = wellness30.data.map(d => d.weight).filter((v): v is number => v != null)
                      if (weights.length < 2) return 'Dernière mesure'
                      const delta = weights[weights.length - 1] - weights[0]
                      return (
                        <span className={delta < 0 ? 'text-green-500' : delta > 0 ? 'text-orange-500' : ''}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg sur 30j
                        </span>
                      )
                    })()}
                  </p>
                </Card>
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">W/kg</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {wPerKg != null ? wPerKg : '—'}
                    {wPerKg != null && <span className="text-lg text-muted-foreground ml-1">W/kg</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {athlete.data?.ftp ? `FTP : ${athlete.data.ftp}W` : 'FTP non disponible'}
                  </p>
                </Card>
                <Card className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-green-500" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Poids moyen</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight">
                    {(() => {
                      const weights = wellness30.data.map(d => d.weight).filter((v): v is number => v != null)
                      const a = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null
                      return a != null ? `${a.toFixed(1)} kg` : '—'
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">sur 30 jours</p>
                </Card>
              </div>

              {/* Weight chart */}
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Weight className="w-5 h-5 text-purple-500" /> Évolution du poids — 30 jours
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Le rapport W/kg est déterminant en montagne. Suivez votre poids pour optimiser ce ratio tout en préservant votre puissance.</p>
                </CardHeader>
                <CardContent className="p-0 h-[280px]">
                  {weightChartData.length > 0 ? (
                    <ChartContainer config={weightChartConfig} className="h-full w-full">
                      <AreaChart data={weightChartData}>
                        <defs>
                          <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(260 60% 60%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(260 60% 60%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v * 10) / 10}kg`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="weight" stroke="var(--color-weight)" fill="url(#weightGradient)" strokeWidth={2} name="Poids" />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée de poids disponible
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* W/kg context */}
              {wPerKg != null && (
                <Card className="apple-card border-none p-8">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-lg font-bold tracking-tight">Contexte W/kg</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-3">
                      {[
                        { label: 'Débutant', range: '1.5 - 2.5', min: 1.5, max: 2.5 },
                        { label: 'Intermédiaire', range: '2.5 - 3.5', min: 2.5, max: 3.5 },
                        { label: 'Avancé', range: '3.5 - 4.5', min: 3.5, max: 4.5 },
                        { label: 'Elite', range: '4.5 - 5.5', min: 4.5, max: 5.5 },
                        { label: 'Pro', range: '5.5+', min: 5.5, max: 7 },
                      ].map((level) => {
                        const val = parseFloat(wPerKg!)
                        const isInRange = val >= level.min && val < level.max
                        return (
                          <div key={level.label} className={cn(
                            "flex items-center justify-between p-3 rounded-xl transition-all",
                            isInRange ? "bg-primary/10 border border-primary/30" : "bg-secondary/20"
                          )}>
                            <span className={cn("text-sm font-medium", isInRange && "text-primary font-bold")}>{level.label}</span>
                            <span className="text-xs text-muted-foreground">{level.range} W/kg</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
