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

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format, subDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceArea } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowLeft, TrendingUp, TrendingDown, Minus, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAthlete, useFitnessChart } from '@/hooks/use-intervals'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { usePowerCurve } from '@/components/cycling/use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { fitCriticalPower } from '@/domain/cycling/metrics/criticalPower'
import { PowerCurveCard } from '@/components/cycling/power-curve-card'
import { METRIC_INFO, type MetricId } from '@/components/cycling/metric-info'
import { tsbZone, TSB_ZONES_ORDERED } from '@/components/cycling/tsb-zones'
import { SourceCitation } from '@/components/coach/source-citation'

// Source-au-clic (Phase 5/UI) — premier déploiement sur les 3 tuiles
// explicitement corrigées suite à l'audit (docs/AUDIT_CYCLING.md §1) :
// HRV/CTL/TSB. Le reste des métriques suit progressivement (ex. ATL,
// PR de suivi — même réserve R03 que CTL : les deux viennent du même
// modèle impulsion-réponse à fenêtres convention, jamais comparables
// d'un athlète/outil à l'autre).
const SOURCE_RULE_IDS: Partial<Record<MetricId, string[]>> = {
  ctl: ['fitness-fatigue-show-trajectory-not-absolute'],
  atl: ['fitness-fatigue-show-trajectory-not-absolute'],
  tsb: ['forbidden-tsb-universal-optimal'],
  hrv: ['principle-3-hrv-sign-ambiguous', 'forbidden-hrv-sign-fatigue-freshness'],
  criticalPower: ['riegel-prefer-critical-power-side-cycling'],
  readiness: ['readiness-composition-explicit-weighting', 'principle-3-hrv-sign-ambiguous', 'forbidden-hrv-sign-fatigue-freshness'],
}

const TREND_DAYS = 180 // ~6 mois

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const oldest = format(subDays(today, TREND_DAYS), 'yyyy-MM-dd')

interface TrendPoint {
  date: string // affichage, dd/MM
  rawDate: string // yyyy-MM-dd, pour le filtre de plage — jamais affiché
  value: number
}

const chartConfig: ChartConfig = {
  value: { label: 'Valeur', color: 'hsl(var(--primary))' },
}

// Boutons "réduire/ajuster la vue" — retour utilisateur : "pouvons nous
// rajouter des petits boutons qui viendraient réduire/ajuster la vue a 1
// semaine, 1 mois, 6 mois, all ?" (capture d'écran de la page HRV à
// l'appui). Filtre purement client-side sur la série déjà chargée — la
// fenêtre de fetch elle-même reste TREND_DAYS (180j, ~6 mois), donc "Tout"
// et "6 mois" affichent la même chose aujourd'hui ; "Tout" reste un bucket
// distinct plutôt qu'un alias codé en dur, pour rester correct si la
// fenêtre de fetch s'élargit un jour (voir CLAUDE.md, WELLNESS_WINDOW_DAYS/
// FITNESS_WINDOW_DAYS).
type RangeOption = '7d' | '30d' | '180d' | 'all'
const RANGE_OPTIONS: { id: RangeOption; label: string; days: number | null }[] = [
  { id: '7d', label: '1 semaine', days: 7 },
  { id: '30d', label: '1 mois', days: 30 },
  { id: '180d', label: '6 mois', days: 180 },
  { id: 'all', label: 'Tout', days: null },
]

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

  const powerRecords = [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  const enduranceIndex = fitEnduranceCurve(powerRecords)?.enduranceIndex ?? null
  const criticalPowerModel = fitCriticalPower(powerRecords)

  // ── Par métrique : série de tendance (null = pas d'historique suivi) + valeur actuelle + unité affichée ──
  const { series, currentValue, isLoading } = useMemo((): { series: TrendPoint[] | null; currentValue: string; isLoading: boolean } => {
    switch (id) {
      case 'tsb':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), rawDate: d.date, value: Math.round(d.tsb) })),
          currentValue: athlete.data?.tsb != null ? safeRound(athlete.data.tsb) : '—',
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'ctl':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), rawDate: d.date, value: Math.round(d.ctl) })),
          currentValue: safeRound(athlete.data?.ctl),
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'atl':
        return {
          series: fitness.data.map((d) => ({ date: format(parseISO(d.date), 'dd/MM', { locale: fr }), rawDate: d.date, value: Math.round(d.atl) })),
          currentValue: safeRound(athlete.data?.atl),
          isLoading: fitness.isLoading || athlete.isLoading,
        }
      case 'sleep':
        return {
          series: lifestyle.dailySeries
            .filter((d) => d.sleepHours != null)
            .map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), rawDate: d.dayId, value: d.sleepHours as number })),
          currentValue: lifestyle.latest?.sleepHours != null ? String(lifestyle.latest.sleepHours) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'hrv':
        return {
          series: lifestyle.dailySeries
            .filter((d) => d.hrv != null)
            .map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), rawDate: d.dayId, value: Math.round(d.hrv as number) })),
          currentValue: lifestyle.latest?.hrv != null ? safeRound(lifestyle.latest.hrv) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'restingHr':
        return {
          series: lifestyle.dailySeries
            .filter((d) => d.restingHR != null)
            .map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), rawDate: d.dayId, value: Math.round(d.restingHR as number) })),
          currentValue: lifestyle.latest?.restingHR != null ? safeRound(lifestyle.latest.restingHR) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'readiness':
        return {
          series: lifestyle.readinessSeries.map((d) => ({ date: format(parseISO(d.dayId), 'dd/MM', { locale: fr }), rawDate: d.dayId, value: d.value })),
          currentValue: lifestyle.readiness != null ? String(lifestyle.readiness) : '—',
          isLoading: lifestyle.isLoading,
        }
      case 'ftp':
        return { series: null, currentValue: athlete.data?.ftp != null ? String(athlete.data.ftp) : '—', isLoading: athlete.isLoading }
      case 'riegel':
        return { series: null, currentValue: enduranceIndex != null ? enduranceIndex.toFixed(2) : '—', isLoading: powerCurve.isLoading }
      case 'criticalPower':
        return { series: null, currentValue: criticalPowerModel != null ? String(Math.round(criticalPowerModel.cpWatts)) : '—', isLoading: powerCurve.isLoading }
      default:
        return { series: null, currentValue: '—', isLoading: false }
    }
  }, [id, fitness.data, fitness.isLoading, athlete.data, athlete.isLoading, lifestyle.dailySeries, lifestyle.latest, lifestyle.readiness, lifestyle.readinessSeries, lifestyle.isLoading, enduranceIndex, criticalPowerModel, powerCurve.isLoading])

  const [range, setRange] = useState<RangeOption>('all')
  const visibleSeries = useMemo(() => {
    if (!series) return null
    const days = RANGE_OPTIONS.find((r) => r.id === range)?.days
    if (days == null) return series // 'all' — pas de filtre, la fenêtre de fetch (TREND_DAYS) reste la seule borne
    const cutoff = format(subDays(today, days), 'yyyy-MM-dd')
    return series.filter((p) => p.rawDate >= cutoff)
  }, [series, range])

  const trendIcon = useMemo(() => {
    if (!series || series.length < 4) return null
    const half = Math.floor(series.length / 2)
    const firstHalfAvg = series.slice(0, half).reduce((a, p) => a + p.value, 0) / half
    const secondHalfAvg = series.slice(half).reduce((a, p) => a + p.value, 0) / (series.length - half)
    if (Math.abs(secondHalfAvg - firstHalfAvg) < firstHalfAvg * 0.02) return Minus
    return secondHalfAvg > firstHalfAvg ? TrendingUp : TrendingDown
  }, [series])
  const TrendIcon = trendIcon

  // "État de fraîcheur" — retour utilisateur : "conserve la couleur comme
  // indicateur et donne le graph d'historique quand on clic dessus", à
  // partir d'une capture du Form chart d'Intervals.icu lui-même (mêmes 5
  // zones/mêmes bornes, voir tsb-zones.ts). Bornes du graphe étendues
  // au-delà des données pour toujours montrer un peu de contexte de chaque
  // bande adjacente à la zone actuelle, jamais rétrécies au point de couper
  // une bande en cours.
  const currentZone = id === 'tsb' && athlete.data?.tsb != null ? tsbZone(athlete.data.tsb) : null
  const tsbYDomain = useMemo((): [number, number] => {
    if (id !== 'tsb' || !visibleSeries || visibleSeries.length === 0) return [-35, 25]
    const values = visibleSeries.map((p) => p.value)
    return [Math.min(...values, -35), Math.max(...values, 25)]
  }, [id, visibleSeries])

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
          <CardContent className="p-6 flex items-baseline gap-3 flex-wrap">
            {isLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <>
                <span className="font-data text-5xl font-bold">{currentValue}</span>
                {info.unit && <span className="text-lg text-muted-foreground">{info.unit}</span>}
                {TrendIcon && <TrendIcon className="w-5 h-5 text-muted-foreground ml-2" />}
                {currentZone && (
                  <span className={cn('ml-2 inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full', currentZone.bgClassName, currentZone.textClassName)}>
                    <span className={cn('w-2 h-2 rounded-full', currentZone.dotClassName)} />
                    {currentZone.label}
                  </span>
                )}
                {SOURCE_RULE_IDS[id] && (
                  <SourceCitation ruleIds={SOURCE_RULE_IDS[id]!} label={`Source de ${info.label}`} className="ml-1" />
                )}
              </>
            )}
          </CardContent>
          {currentZone && (
            <CardContent className="px-6 pt-0 pb-5 -mt-2">
              <p className="text-xs text-muted-foreground">{currentZone.description}</p>
            </CardContent>
          )}
          {id === 'criticalPower' && criticalPowerModel && (
            <CardContent className="px-6 pt-0 pb-5 -mt-2">
              <p className="text-xs text-muted-foreground">
                W′ {(criticalPowerModel.wPrimeJoules / 1000).toFixed(1)} kJ — la réserve de travail mobilisable au-dessus de la CP avant épuisement.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Riegel/Puissance critique n'ont pas de courbe d'historique
            (recalculés à la volée depuis les mêmes 3 records personnels,
            jamais stockés jour par jour) — cette page devient plutôt leur
            destination "détail" pour la saisie des records de puissance et
            le calculateur de TTE, déplacés ici depuis la page Cyclisme
            principale (retour utilisateur : ce module n'avait pas sa place
            noyé dans PMC — voir CLAUDE.md). Le composant gère lui-même son
            propre état "pas assez de données". */}
        {id === 'riegel' || id === 'criticalPower' ? (
          <PowerCurveCard />
        ) : (
        <Card className="lc-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
            <CardTitle className="text-base">
              {range === 'all' ? `Sur les ${TREND_DAYS} derniers jours` : `Sur ${RANGE_OPTIONS.find((r) => r.id === range)?.label.toLowerCase()}`}
            </CardTitle>
            {series && series.length > 1 && (
              <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                      range === r.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full rounded-lg" />
            ) : visibleSeries && visibleSeries.length > 1 ? (
              <>
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                  <LineChart data={visibleSeries}>
                    {id === 'tsb' && TSB_ZONES_ORDERED.map((z) => (
                      <ReferenceArea
                        key={z.id}
                        y1={z.min ?? tsbYDomain[0]}
                        y2={z.max ?? tsbYDomain[1]}
                        fill={z.fillColor}
                        fillOpacity={0.12}
                        strokeOpacity={0}
                      />
                    ))}
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={id === 'tsb' ? tsbYDomain : ['auto', 'auto']} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
                {id === 'tsb' && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border">
                    {TSB_ZONES_ORDERED.map((z) => (
                      <span key={z.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn('w-2 h-2 rounded-full', z.dotClassName)} />
                        {z.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                size="compact"
                icon={History}
                title="Pas encore d'historique suivi"
                description={
                  id === 'ftp'
                    ? "Cet indicateur n'est pas enregistré jour par jour aujourd'hui — seule la valeur actuelle est disponible."
                    : "Pas assez de données sur cette période pour tracer une tendance."
                }
              />
            )}
          </CardContent>
        </Card>
        )}

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
