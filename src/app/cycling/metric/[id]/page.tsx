"use client"

// Page détail d'un indicateur de Vue d'ensemble — "quand on clic sur les
// indicateurs (HRV par exemple), pourquoi ne pas avoir une page derrière
// qui montre une courbe de X derniers mois et une explication de quel est
// le principe de cet indicateur, comme ça pour chacun." Une seule route
// dynamique pour les 8 métriques plutôt que 8 pages quasi identiques —
// seule la source de données change (fitness chart pour CTL/ATL/TSB,
// Vie & Santé pour Sommeil/HRV/Readiness). FTP et l'indice Riegel n'ont
// pas d'historique suivi dans le temps aujourd'hui (FTP vient d'un test
// ponctuel Intervals.icu, l'indice Riegel est recalculé à la volée depuis
// la courbe de puissance actuelle, jamais stocké jour par jour) — la page
// le dit honnêtement plutôt que d'inventer une tendance.

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, subDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowLeft, TrendingUp, TrendingDown, Minus, History } from 'lucide-react'
import { useAthlete, useFitnessChart } from '@/hooks/use-intervals'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { usePowerCurve } from '@/components/cycling/use-power-curve'
import { fitPowerDurationCurve, type PowerRecord } from '@/components/cycling/riegel-types'
import { METRIC_INFO, type MetricId } from '@/components/cycling/metric-info'

const TREND_DAYS = 180 // ~6 mois

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest = format(subDays(today, TREND_DAYS), 'yyyy-MM-dd')

interface TrendPoint {
  date: string // affichage, dd/MM
  value: number
}

const chartConfig: ChartConfig = {
  value: { label: 'Valeur', color: 'hsl(var(--primary))' },
}

function safeRound(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—'
  return String(Math.round(value))
}

export default function MetricDetailPage() {
  const params = useParams<{ id: string }>()
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) as MetricId
  const info = METRIC_INFO[id]

  const athlete = useAthlete()
  const fitness = useFitnessChart(oldest, newest)
  const lifestyle = useLifestyleData(TREND_DAYS)
  const powerCurve = usePowerCurve()

  const enduranceIndex = fitPowerDurationCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null

  // ── Par métrique : série de tendance (null = pas d'historique suivi) + valeur actuelle + unité affichée ──
  const { series, currentValue, isLoading } = useMemo((): { series: TrendPoint[] | null; currentValue: string; isLoading: boolean } => {
    switch (id) {
      case 'tsb':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), value: Math.round(d.tsb) })),
          currentValue: athlete.data?.tsb != null ? safeRound(athlete.data.tsb) : '—',
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'ctl':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), value: Math.round(d.ctl) })),
          currentValue: safeRound(athlete.data?.ctl),
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'atl':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), value: Math.round(d.atl) })),
          currentValue: safeRound(athlete.data?.atl),
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'sleep':
        return {
          series: lifestyle.dailySeries
            .filter((d) => d.sleepHours != null)
            .map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), value: d.sleepHours as number })),
          currentValue: lifestyle.latest?.sleepHours != null ? String(lifestyle.latest.sleepHours) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'hrv':
        return {
          series: lifestyle.dailySeries
            .filter((d) => d.hrv != null)
            .map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), value: d.hrv as number })),
          currentValue: lifestyle.latest?.hrv != null ? String(lifestyle.latest.hrv) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'readiness':
        return {
          series: lifestyle.readinessSeries.map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), value: d.value })),
          currentValue: lifestyle.readiness != null ? String(lifestyle.readiness) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'ftp':
        return { series: null, currentValue: athlete.data?.ftp != null ? String(athlete.data.ftp) : '—', isLoading: athlete.isLoading }
      case 'riegel':
        return { series: null, currentValue: enduranceIndex != null ? enduranceIndex.toFixed(2) : '—', isLoading: powerCurve.isLoading }
      default:
        return { series: null, currentValue: '—', isLoading: false }
    }
  }, [id, fitness.data, fitness.isLoading, athlete.data, athlete.isLoading, lifestyle.dailySeries, lifestyle.latest, lifestyle.readiness, lifestyle.readinessSeries, lifestyle.isLoading, enduranceIndex, powerCurve.isLoading])

  const trendIcon = useMemo(() => {
    if (!series || series.length < 4) return null
    const half = Math.floor(series.length / 2)
    const firstHalfAvg = series.slice(0, half).reduce((a, p) => a + p.value, 0) / half
    const secondHalfAvg = series.slice(half).reduce((a, p) => a + p.value, 0) / (series.length - half)
    if (Math.abs(secondHalfAvg - firstHalfAvg) < firstHalfAvg * 0.02) return Minus
    return secondHalfAvg > firstHalfAvg ? TrendingUp : TrendingDown
  }, [series])
  const TrendIcon = trendIcon

  if (!info) {
    return (
      <AuthGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
        <AppNavigation />
        <main className="p-4 md:p-8 max-w-3xl mx-auto">
          <EmptyState icon={History} title="Indicateur inconnu" description="Retournez à Cyclisme pour repartir de la Vue d'ensemble." />
        </main>
      </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/cycling" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à Cyclisme
        </Link>

        <PageHeader category="Vue d'ensemble" title={info.label} description={info.tagline} />

        <Card className="lc-card">
          <CardContent className="p-6 flex items-baseline gap-3">
            {isLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <>
                <span className="font-data text-5xl font-bold">{currentValue}</span>
                {info.unit && <span className="text-lg text-muted-foreground">{info.unit}</span>}
                {TrendIcon && <TrendIcon className="w-5 h-5 text-muted-foreground ml-2" />}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Sur les {TREND_DAYS} derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : series && series.length > 1 ? (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState
                size="compact"
                icon={History}
                title="Pas encore d'historique suivi"
                description={
                  id === 'ftp' || id === 'riegel'
                    ? "Cet indicateur n'est pas enregistré jour par jour aujourd'hui — seule la valeur actuelle est disponible."
                    : "Pas assez de données sur cette période pour tracer une tendance."
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Le principe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {info.explanation.map((paragraph, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{paragraph}</p>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
