"use client"

import React, { useMemo } from 'react'
import { format, subDays, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from 'recharts'
import {
  Bike,
  Wrench,
  History,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Settings,
  Mountain,
  Timer,
  Flame,
} from 'lucide-react'
import Link from 'next/link'
import { useAthlete, useActivities, useFitnessChart } from '@/hooks/use-intervals'

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}

function tsbLabel(tsb: number): { text: string; className: string } {
  if (tsb > 25) return { text: 'Très reposé', className: 'text-blue-400' }
  if (tsb > 5) return { text: 'Forme optimale', className: 'text-green-400' }
  if (tsb > -10) return { text: 'En charge', className: 'text-yellow-400' }
  return { text: 'Fatigue élevée', className: 'text-red-400' }
}

// ── Date ranges ──────────────────────────────────────────────────────

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const activitiesOldest = format(subDays(today, 30), 'yyyy-MM-dd')
const fitnessOldest = format(subDays(today, 84), 'yyyy-MM-dd') // 12 semaines

// ── Chart config ─────────────────────────────────────────────────────

const fitnessChartConfig: ChartConfig = {
  ctl: { label: 'Fitness (CTL)', color: 'hsl(230, 84%, 63%)' },
  atl: { label: 'Fatigue (ATL)', color: 'hsl(0, 84%, 63%)' },
  tsb: { label: 'Forme (TSB)', color: 'hsl(142, 71%, 45%)' },
}

const loadChartConfig: ChartConfig = {
  trainingLoad: { label: 'Charge (TSS)', color: 'hsl(230, 84%, 63%)' },
}

// ── Banner "Non configuré" ───────────────────────────────────────────

function NotConfiguredBanner() {
  return (
    <Card className="bg-card/40 border-border border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <AlertTriangle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Intervals.icu non connecté</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Configurez votre ID Athlète et clé API dans les réglages pour synchroniser vos données de performance.
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

// ── Loading skeleton ─────────────────────────────────────────────────

function FitnessCardSkeleton() {
  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="pb-2">
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

// ── Main page ────────────────────────────────────────────────────────

export default function CyclingHub() {
  const athlete = useAthlete()
  const activities = useActivities(activitiesOldest, newest)
  const fitness = useFitnessChart(fitnessOldest, newest)

  const isConfigured = athlete.isConfigured

  // Aggregate weekly load from fitness data
  const weeklyLoad = useMemo(() => {
    if (!fitness.data.length) return []
    const weeks: Record<string, number> = {}
    for (const day of fitness.data) {
      // Get Monday of the week
      const d = parseISO(day.date)
      const dayOfWeek = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7))
      const key = format(monday, 'dd/MM')
      weeks[key] = (weeks[key] || 0) + (day.trainingLoad || 0)
    }
    return Object.entries(weeks).map(([week, load]) => ({ week, trainingLoad: Math.round(load) }))
  }, [fitness.data])

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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Performance</h2>
            <h1 className="text-3xl font-bold">LifeCycle Vault</h1>
          </div>
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-muted gap-2"
              onClick={() => { athlete.refresh(); activities.refresh(); fitness.refresh() }}
              disabled={athlete.isLoading || activities.isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${athlete.isLoading ? 'animate-spin' : ''}`} />
              Synchroniser
            </Button>
          )}
        </header>

        <Tabs defaultValue="training" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-auto grid grid-cols-3 max-w-lg">
            <TabsTrigger value="training" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <Activity className="w-4 h-4 mr-2" /> Entraînement
            </TabsTrigger>
            <TabsTrigger value="pmc" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <TrendingUp className="w-4 h-4 mr-2" /> PMC
            </TabsTrigger>
            <TabsTrigger value="gear" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <Wrench className="w-4 h-4 mr-2" /> Matériel
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Entraînement ──────────────────────────────────── */}
          <TabsContent value="training" className="space-y-8">
            {!isConfigured && !athlete.isLoading ? (
              <NotConfiguredBanner />
            ) : (
              <>
                {/* Fitness cards */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {athlete.isLoading ? (
                    <>
                      <FitnessCardSkeleton />
                      <FitnessCardSkeleton />
                      <FitnessCardSkeleton />
                      <FitnessCardSkeleton />
                    </>
                  ) : athlete.data ? (
                    <>
                      <Card className="bg-card/40 border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground uppercase">Fitness (CTL)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold">{Math.round(athlete.data.icu_ctl)}</div>
                          <div className="mt-2 flex items-center text-xs text-muted-foreground">
                            <TrendingUp className="w-3 h-3 mr-1" /> Charge chronique
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card/40 border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground uppercase">Fatigue (ATL)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold">{Math.round(athlete.data.icu_atl)}</div>
                          <Progress value={Math.min(100, (athlete.data.icu_atl / Math.max(athlete.data.icu_ctl, 1)) * 100)} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                      <Card className="bg-card/40 border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground uppercase">Forme (TSB)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const tsb = Math.round(athlete.data.icu_tsb)
                            const label = tsbLabel(tsb)
                            return (
                              <>
                                <div className={`text-4xl font-bold ${label.className}`}>
                                  {tsb > 0 ? `+${tsb}` : tsb}
                                </div>
                                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                  {tsb >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                  {label.text}
                                </div>
                              </>
                            )
                          })()}
                        </CardContent>
                      </Card>
                      <Card className="bg-card/40 border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-muted-foreground uppercase">FTP</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold">{athlete.data.icu_ftp}<span className="text-lg text-muted-foreground ml-1">W</span></div>
                          {athlete.data.icu_weight > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {(athlete.data.icu_ftp / athlete.data.icu_weight).toFixed(2)} W/kg
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : athlete.error ? (
                    <Card className="bg-card/40 border-border col-span-full">
                      <CardContent className="py-8 text-center text-sm text-destructive">
                        Erreur : {athlete.error}
                      </CardContent>
                    </Card>
                  ) : null}
                </section>

                {/* Activity log */}
                <Card className="bg-card/40 border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Journal d&apos;activités</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {activities.data.length} activité{activities.data.length > 1 ? 's' : ''}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {activities.isLoading ? (
                      <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : activities.data.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        Aucune activité sur les 30 derniers jours
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {activities.data.slice(0, 20).map((ride) => (
                          <div key={ride.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Bike className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-semibold">{ride.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(parseISO(ride.start_date_local), { addSuffix: true, locale: fr })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="hidden md:flex flex-col items-end">
                                <span className="text-sm font-medium">{formatDistance(ride.distance)}</span>
                                <span className="text-[10px] text-muted-foreground">Distance</span>
                              </div>
                              {ride.icu_average_watts && (
                                <div className="hidden md:flex flex-col items-end">
                                  <span className="text-sm font-medium">{ride.icu_average_watts}W</span>
                                  <span className="text-[10px] text-muted-foreground">Puis. Moy</span>
                                </div>
                              )}
                              {ride.total_elevation_gain > 0 && (
                                <div className="hidden lg:flex flex-col items-end">
                                  <span className="text-sm font-medium flex items-center gap-1">
                                    <Mountain className="w-3 h-3" /> {Math.round(ride.total_elevation_gain)}m
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">D+</span>
                                </div>
                              )}
                              {ride.icu_training_load && (
                                <div className="hidden lg:flex flex-col items-end">
                                  <span className="text-sm font-medium">{Math.round(ride.icu_training_load)}</span>
                                  <span className="text-[10px] text-muted-foreground">TSS</span>
                                </div>
                              )}
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-medium flex items-center gap-1">
                                  <Timer className="w-3 h-3" /> {formatDuration(ride.moving_time)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Durée</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── Tab PMC (Performance Management Chart) ────────────── */}
          <TabsContent value="pmc" className="space-y-8">
            {!isConfigured && !athlete.isLoading ? (
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
          </TabsContent>

          {/* ── Tab Matériel (inchangé – hardcoded pour l'instant) ── */}
          <TabsContent value="gear" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Bike className="w-6 h-6 text-primary" /> Vos Vélos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all">
                      <div className="h-32 bg-muted relative">
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Badge className="bg-accent/20 text-accent border-accent/20">Route</Badge>
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <h4 className="font-bold text-lg">Canyon Ultimate CF SLX</h4>
                        <p className="text-xs text-muted-foreground mb-4">Total: 8,420 km</p>
                        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                          Gérer les composants <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all">
                      <div className="h-32 bg-muted relative">
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Badge className="bg-primary/20 text-primary border-primary/20">VTT</Badge>
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <h4 className="font-bold text-lg">Specialized Epic Evo</h4>
                        <p className="text-xs text-muted-foreground mb-4">Total: 2,150 km</p>
                        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                          Gérer les composants <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Zap className="w-6 h-6 text-accent" /> Alertes Maintenance
                  </h3>
                  <div className="space-y-3">
                    {[
                      { item: 'Chaîne (Canyon Ultimate)', km: 3250, limit: 4000, status: 'warning' as const },
                      { item: 'Plaquettes Avant (Specialized)', km: 1800, limit: 2000, status: 'urgent' as const },
                      { item: 'Pneus GP5000 (Canyon)', km: 4500, limit: 5000, status: 'warning' as const }
                    ].map((maint, i) => (
                      <div key={i} className="flex flex-col gap-2 p-4 bg-card/40 border border-border rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{maint.item}</span>
                          <Badge variant={maint.status === 'urgent' ? 'destructive' : 'secondary'}>
                            {maint.status === 'urgent' ? 'Remplacer' : 'Surveiller'}
                          </Badge>
                        </div>
                        <Progress value={(maint.km / maint.limit) * 100} className="h-2" />
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-tight">
                          <span>Usage: {maint.km} km</span>
                          <span>Limite: {maint.limit} km</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-primary" /> Pression Pneus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Poids Cycliste</label>
                          <Input type="number" defaultValue={75} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Largeur Pneu</label>
                          <Input type="number" defaultValue={28} className="h-8" />
                        </div>
                      </div>
                      <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        Calculer Pression
                      </Button>
                    </div>
                    <div className="pt-6 border-t border-border grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xl font-bold">5.2</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Avant (Bar)</div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xl font-bold">5.4</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Arrière (Bar)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" /> Derniers Coûts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { item: 'Chaîne Shimano 11v', price: '45€', date: '20 Mai' },
                      { item: 'Plaquettes Organiques', price: '18€', date: '12 Mai' },
                      { item: 'Lubrifiant SQUIRT', price: '12€', date: '05 Mai' }
                    ].map((cost, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                        <div>
                          <div className="text-sm font-medium">{cost.item}</div>
                          <div className="text-[10px] text-muted-foreground">{cost.date}</div>
                        </div>
                        <div className="font-bold text-accent">{cost.price}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
