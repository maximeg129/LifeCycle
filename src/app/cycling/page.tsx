"use client"

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { format, subDays, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bike,
  Wrench,
  ChevronRight,
  TrendingUp,
  Activity,
  Timer,
  Flame,
  Droplets,
  Sparkles,
  Target,
  MessageCircle,
} from 'lucide-react'
import { useAthlete, useActivities, useFitnessChart } from '@/hooks/use-intervals'
import { NotConfiguredBanner } from '@/components/cycling/not-configured-banner'
import { KJBudgetWidget } from '@/components/cycling/kj-budget-widget'
import { GovernorWidget } from '@/components/cycling/governor-widget'
import { QuickFeedbackButton } from '@/components/cycling/quick-feedback-widget'
import { useGovernor } from '@/components/cycling/use-governor'
import { SyncButton } from '@/components/cycling/sync-button'
import { PageHeader } from '@/components/ui/page-header'
import { PerformanceBento } from '@/components/cycling/performance-bento'
import { BrainCircuit } from 'lucide-react'

// Code-split: only the Entraînement tab (the default) ships in the main
// cycling bundle. The other four tabs — each a self-contained, Firestore-
// or Recharts-heavy component — load on demand when actually opened. See
// PLAN.md 2.4 (cycling was the single heaviest page in the app: 459 kB
// first load, ~4x most other modules, because none of its 5 tabs were
// split out).
const PmcTab = dynamic(() => import('@/components/cycling/pmc-tab').then(m => m.PmcTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const CoachMemoryTab = dynamic(() => import('@/components/cycling/coach-memory-tab').then(m => m.CoachMemoryTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const GearTab = dynamic(() => import('@/components/cycling/gear-tab').then(m => m.GearTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const ChainsTab = dynamic(() => import('@/components/cycling/chains-tab').then(m => m.ChainsTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const DailyWorkoutTab = dynamic(() => import('@/components/cycling/daily-workout-tab').then(m => m.DailyWorkoutTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const TrainingPlanTab = dynamic(() => import('@/components/cycling/training-plan-tab').then(m => m.TrainingPlanTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const StellaChatTab = dynamic(() => import('@/components/cycling/stella-chat-tab').then(m => m.StellaChatTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})

// ── Helpers ──────────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || isNaN(meters)) return '—'
  const km = meters / 1000
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}

// ── Date ranges ──────────────────────────────────────────────────────

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const activitiesOldest = format(subDays(today, 30), 'yyyy-MM-dd')
const fitnessOldest = format(subDays(today, 84), 'yyyy-MM-dd') // 12 semaines

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
  const governor = useGovernor()

  // Map date → daily training load from fitness data
  const dailyLoad = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of fitness.data) {
      if (day.trainingLoad > 0) map.set(day.date, day.trainingLoad)
    }
    return map
  }, [fitness.data])

  const isConfigured = athlete.isConfigured

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <PageHeader category="Performance" title="LifeCycle Vault" actions={<SyncButton />} />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <Activity className="w-4 h-4 mr-2" /> Vue d&apos;ensemble
            </TabsTrigger>
            <TabsTrigger value="pmc" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <TrendingUp className="w-4 h-4 mr-2" /> PMC
            </TabsTrigger>
            <TabsTrigger value="coaching" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <BrainCircuit className="w-4 h-4 mr-2" /> Coaching
            </TabsTrigger>
            <TabsTrigger value="garage" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <Wrench className="w-4 h-4 mr-2" /> Garage
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Vue d'ensemble ──────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-8">
            {!isConfigured && !athlete.isLoading ? (
              <NotConfiguredBanner />
            ) : (
              <>
                {/* Fitness — hero TSB + stat trio + discover tiles + cross-domain strip */}
                {athlete.isLoading ? (
                  <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FitnessCardSkeleton />
                    <FitnessCardSkeleton />
                    <FitnessCardSkeleton />
                    <FitnessCardSkeleton />
                  </section>
                ) : athlete.data ? (
                  <PerformanceBento athlete={athlete.data} />
                ) : athlete.error ? (
                  <Card className="bg-card/40 border-border">
                    <CardContent className="py-8 text-center text-sm text-destructive">
                      Erreur : {athlete.error}
                    </CardContent>
                  </Card>
                ) : null}

                {/* kJ budget + internal load governor — real mechanical work, not TSS/rigid plan */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KJBudgetWidget governorStatus={governor.status} />
                  <GovernorWidget />
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
                        {activities.data.slice(0, 20).map((ride) => {
                          const dateStr = ride.start_date_local?.slice(0, 10)
                          const load = dateStr ? dailyLoad.get(dateStr) : undefined
                          return (
                            <a
                              key={ride.id}
                              href={`https://intervals.icu/activities/${ride.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <Bike className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-semibold">
                                    {ride.name || (dateStr ? format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }) : 'Activité')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {ride.start_date_local
                                      ? formatDistanceToNow(parseISO(ride.start_date_local), { addSuffix: true, locale: fr })
                                      : 'Date inconnue'}
                                    {ride.source === 'STRAVA' && (
                                      <span className="ml-2 text-orange-400">Strava</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                {ride.distance ? (
                                  <div className="hidden md:flex flex-col items-end">
                                    <span className="text-sm font-medium">{formatDistance(ride.distance)}</span>
                                    <span className="text-[10px] text-muted-foreground">Distance</span>
                                  </div>
                                ) : null}
                                {ride.moving_time ? (
                                  <div className="hidden md:flex flex-col items-end">
                                    <span className="text-sm font-medium flex items-center gap-1">
                                      <Timer className="w-3 h-3" /> {formatDuration(ride.moving_time)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">Durée</span>
                                  </div>
                                ) : null}
                                {(ride.icu_training_load || load) && (
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm font-medium flex items-center gap-1">
                                      <Flame className="w-3 h-3 text-orange-400" />
                                      {Math.round(ride.icu_training_load ?? load ?? 0)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">Charge</span>
                                  </div>
                                )}
                                <QuickFeedbackButton activityId={ride.id} date={dateStr ?? format(new Date(), 'yyyy-MM-dd')} />
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── Tab PMC (Performance Management Chart) — code-split ── */}
          <TabsContent value="pmc" className="space-y-8">
            <PmcTab isConfigured={isConfigured} athleteLoading={athlete.isLoading} fitness={fitness} />
          </TabsContent>

          {/* ── Tab Coaching — Plan / Proposition du jour / Stella / Mémoire
               coach regroupés (anciennement 4 onglets séparés) ── */}
          <TabsContent value="coaching" className="space-y-6">
            <Tabs defaultValue="plan">
              <TabsList className="bg-card/30 border border-border/60 p-1 h-auto flex flex-wrap gap-1">
                <TabsTrigger value="plan" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <Target className="w-3.5 h-3.5 mr-1.5" /> Plan
                </TabsTrigger>
                <TabsTrigger value="daily-workout" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Proposition du jour
                </TabsTrigger>
                <TabsTrigger value="stella" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Stella
                </TabsTrigger>
                <TabsTrigger value="memory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> Mémoire coach
                </TabsTrigger>
              </TabsList>
              <TabsContent value="plan" className="space-y-8 pt-6">
                <TrainingPlanTab />
              </TabsContent>
              <TabsContent value="daily-workout" className="space-y-8 pt-6">
                <DailyWorkoutTab />
              </TabsContent>
              <TabsContent value="stella" className="space-y-8 pt-6">
                <StellaChatTab />
              </TabsContent>
              <TabsContent value="memory" className="space-y-8 pt-6">
                <CoachMemoryTab governorStatus={governor.status} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Tab Garage — Matériel / Chaînes regroupés ── */}
          <TabsContent value="garage" className="space-y-6">
            <Tabs defaultValue="gear">
              <TabsList className="bg-card/30 border border-border/60 p-1 h-auto flex flex-wrap gap-1">
                <TabsTrigger value="gear" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <Wrench className="w-3.5 h-3.5 mr-1.5" /> Matériel
                </TabsTrigger>
                <TabsTrigger value="chains" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
                  <Droplets className="w-3.5 h-3.5 mr-1.5" /> Chaînes
                </TabsTrigger>
              </TabsList>
              <TabsContent value="gear" className="space-y-8 pt-6">
                <GearTab />
              </TabsContent>
              <TabsContent value="chains" className="space-y-8 pt-6">
                <ChainsTab />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
