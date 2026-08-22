"use client"

import React, { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  HeartPulse,
  Moon,
  Zap,
  Smile,
  Activity,
  TrendingUp,
  TrendingDown,
  Sun,
  Droplets,
  ThermometerSun,
  Target,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { doc, deleteDoc } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { LogMetricDialog } from '@/components/lifestyle/log-metric-dialog'
import { AddGoalDialog } from '@/components/lifestyle/add-goal-dialog'
import { average, trendPct, computeGoalProgress, type HealthGoal } from '@/components/lifestyle/lifestyle-types'

type WithIdGoal = HealthGoal & { id: string }

function dayLabel(dayId: string) {
  const [y, m, d] = dayId.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'EEE', { locale: fr })
}

export default function LifestylePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()

  const { dailySeries, latest, readiness, goals, isLoading } = useLifestyleData()

  const sleepSeries = dailySeries.map((d) => ({ day: dayLabel(d.dayId), hours: d.sleepHours ?? null, quality: d.sleepQuality ?? null }))
  const hrvSeries = dailySeries.map((d) => ({ day: dayLabel(d.dayId), hrv: d.hrv ?? null }))
  const moodSeries = dailySeries.map((d) => ({ day: dayLabel(d.dayId), score: d.mood ?? null }))

  const sleepValues = dailySeries.map((d) => d.sleepHours).filter((v): v is number => v !== undefined)
  const qualityValues = dailySeries.map((d) => d.sleepQuality).filter((v): v is number => v !== undefined)
  const hrvValues = dailySeries.map((d) => d.hrv).filter((v): v is number => v !== undefined)
  const avgSleep = average(sleepValues)
  const avgQuality = Math.round(average(qualityValues))
  const hrvHalf = Math.max(1, Math.floor(hrvValues.length / 2))
  const hrvTrend = trendPct(average(hrvValues.slice(0, hrvHalf)), average(hrvValues.slice(-hrvHalf)))

  const metrics = [
    { icon: Moon, label: 'Sommeil', value: latest?.sleepHours !== undefined ? `${latest.sleepHours}h` : '—', subtitle: latest?.sleepQuality !== undefined ? `Qualité : ${latest.sleepQuality}%` : 'Aucune donnée', color: 'text-indigo-500', bg: 'bg-indigo-500/10', progress: latest?.sleepQuality ?? 0 },
    { icon: Activity, label: 'HRV', value: latest?.hrv !== undefined ? `${latest.hrv} ms` : '—', subtitle: latest?.hrv !== undefined ? 'Dernière mesure' : 'Aucune donnée', color: 'text-red-500', bg: 'bg-red-500/10', progress: latest?.hrv ? Math.min(100, latest.hrv) : 0 },
    { icon: Smile, label: 'Stress', value: latest?.stressScore !== undefined ? `${latest.stressScore}/100` : '—', subtitle: latest?.stressScore !== undefined ? (latest.stressScore < 35 ? 'Bas' : latest.stressScore < 65 ? 'Modéré' : 'Élevé') : 'Aucune donnée', color: 'text-yellow-500', bg: 'bg-yellow-500/10', progress: latest?.stressScore ?? 0 },
    { icon: Zap, label: 'Readiness', value: readiness !== null ? `${readiness}/100` : '—', subtitle: readiness !== null ? (readiness > 75 ? 'Prêt pour l’effort' : readiness > 50 ? 'Effort modéré conseillé' : 'Privilégiez la récupération') : 'Aucune donnée', color: 'text-orange-500', bg: 'bg-orange-500/10', progress: readiness ?? 0 },
  ]

  const handleDeleteGoal = async (goal: WithIdGoal) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/healthGoals`, goal.id)
    try {
      await deleteDoc(ref)
      toast({ title: 'Objectif supprimé' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Bien-être</h2>
            <h1 className="text-3xl font-bold">Vie & Santé</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-fit rounded-full px-4 py-1.5 text-xs font-bold border-primary/20 text-primary bg-primary/5">
              <HeartPulse className="w-3.5 h-3.5 mr-2" />
              {latest?.date?.seconds ? `Dernière mesure : ${format(new Date(latest.date.seconds * 1000), 'dd MMM', { locale: fr })}` : 'Aucune mesure'}
            </Badge>
            <LogMetricDialog />
          </div>
        </header>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="overview" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Zap className="w-4 h-4 mr-2" /> Vue d&apos;ensemble
            </TabsTrigger>
            <TabsTrigger value="sleep" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Moon className="w-4 h-4 mr-2" /> Sommeil
            </TabsTrigger>
            <TabsTrigger value="recovery" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Activity className="w-4 h-4 mr-2" /> Récupération
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted/20 animate-pulse" />)}
            </div>
          ) : (
          <>
          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((m) => (
                <Card key={m.label} className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center', m.bg)}>
                      <m.icon className={cn('w-5 h-5', m.color)} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight mb-2">{m.value}</div>
                  <p className="text-xs text-muted-foreground mb-4">{m.subtitle}</p>
                  <Progress value={m.progress} className="h-1.5" />
                </Card>
              ))}
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> Objectifs bien-être
                </CardTitle>
                <AddGoalDialog />
              </CardHeader>
              <CardContent className="p-0">
                {goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun objectif pour l&apos;instant — créez-en un pour suivre vos progrès sur 7 jours.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.map((goal) => {
                      const progress = computeGoalProgress(goal, dailySeries)
                      return (
                        <div key={goal.id} className="p-5 rounded-2xl bg-secondary/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">{goal.label}</h4>
                            <button onClick={() => handleDeleteGoal(goal)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <Progress value={progress.pct} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">
                            Moyenne 7j : {progress.currentAvg ? progress.currentAvg.toFixed(1) : '—'} · cible {goal.direction === 'min' ? '≥' : '≤'} {goal.target}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {moodSeries.some((m) => m.score !== null) && (
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Smile className="w-5 h-5 text-primary" /> Humeur de la semaine
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={moodSeries}>
                      <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 10]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#moodGradient)" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Conseils du jour</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: Sun, title: 'Lumière matinale', desc: "Exposez-vous à la lumière naturelle dans les 30 min après le réveil.", color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                    { icon: Droplets, title: 'Hydratation', desc: 'Objectif : 2.5L aujourd’hui. Ajoutez 500ml post-entraînement.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    {
                      icon: ThermometerSun,
                      title: 'Séance idéale',
                      desc: readiness !== null
                        ? readiness > 75
                          ? 'Votre readiness est haute — placez un effort d’intensité Z4/Z5.'
                          : readiness > 50
                            ? 'Readiness moyenne — une sortie d’endurance conviendra mieux qu’un effort intense.'
                            : 'Readiness basse — privilégiez une journée de récupération active.'
                        : 'Enregistrez vos mesures pour recevoir une recommandation.',
                      color: 'text-orange-500',
                      bg: 'bg-orange-500/10',
                    },
                  ].map((tip) => (
                    <div key={tip.title} className="p-6 rounded-2xl bg-secondary/30 space-y-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tip.bg)}>
                        <tip.icon className={cn('w-5 h-5', tip.color)} />
                      </div>
                      <h4 className="font-bold text-sm">{tip.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sleep" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Moyenne</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{sleepValues.length ? `${avgSleep.toFixed(1)}h` : '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">sur {sleepValues.length} jour{sleepValues.length > 1 ? 's' : ''} renseigné{sleepValues.length > 1 ? 's' : ''}</p>
              </Card>
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Qualité Moy.</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{qualityValues.length ? `${avgQuality}%` : '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">sur les 7 derniers jours</p>
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Moon className="w-5 h-5 text-indigo-500" /> Durée & qualité de sommeil
                </CardTitle>
              </CardHeader>
              {sleepValues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Enregistrez vos mesures de sommeil pour voir ce graphique.</p>
              ) : (
                <CardContent className="p-0 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sleepSeries}>
                      <defs>
                        <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(240 60% 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(240 60% 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                      <Area type="monotone" dataKey="hours" stroke="hsl(240 60% 60%)" fill="url(#sleepGradient)" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              )}
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Détail par nuit</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  {dailySeries.filter((d) => d.sleepHours !== undefined).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune nuit enregistrée pour l&apos;instant.</p>
                  ) : dailySeries.filter((d) => d.sleepHours !== undefined).map((night) => (
                    <div key={night.dayId} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30">
                      <span className="font-bold text-sm w-12">{dayLabel(night.dayId)}</span>
                      <div className="flex-1 mx-6">
                        <Progress value={night.sleepQuality ?? 0} className="h-2" />
                      </div>
                      <span className="text-sm font-bold w-16 text-right">{night.sleepHours}h</span>
                      {night.sleepQuality !== undefined && (
                        <Badge variant="outline" className={cn(
                          'ml-4 rounded-full text-[10px] font-bold border-none px-3',
                          night.sleepQuality >= 85 ? 'bg-green-500/10 text-green-500' :
                          night.sleepQuality >= 70 ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        )}>
                          {night.sleepQuality}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recovery" className="space-y-8 animate-in fade-in duration-500">
            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500" /> Variabilité cardiaque (HRV)
                </CardTitle>
              </CardHeader>
              {hrvValues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Enregistrez votre HRV pour voir ce graphique.</p>
              ) : (
                <CardContent className="p-0 h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hrvSeries}>
                      <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                      <Line type="monotone" dataKey="hrv" stroke="hsl(0 84% 60%)" strokeWidth={2.5} dot={{ fill: 'hsl(0 84% 60%)', r: 5 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              )}
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Analyse de la récupération</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {hrvValues.length === 0 && sleepValues.length === 0 ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enregistrez quelques jours de mesures pour débloquer une analyse de votre récupération.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
                    {hrvTrend >= 0
                      ? <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
                      : <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />}
                    Votre HRV est {hrvTrend >= 0 ? 'en hausse' : 'en baisse'} de {Math.abs(hrvTrend)}% sur la période enregistrée
                    {sleepValues.length > 0 && `, pour une moyenne de sommeil de ${avgSleep.toFixed(1)}h.`}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-2">
                    <h5 className="font-bold text-sm flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-4 h-4" /> Points forts
                    </h5>
                    <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                      {qualityValues.length > 0 && avgQuality >= 80 && <li>Qualité de sommeil au-dessus de 80% en moyenne</li>}
                      {hrvTrend > 0 && <li>HRV en tendance haussière</li>}
                      {readiness !== null && readiness > 75 && <li>Readiness élevée sur la dernière mesure</li>}
                      {(qualityValues.length === 0 || avgQuality < 80) && hrvTrend <= 0 && (readiness === null || readiness <= 75) && (
                        <li>Continuez à logger vos mesures pour faire ressortir des tendances</li>
                      )}
                    </ul>
                  </div>
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl space-y-2">
                    <h5 className="font-bold text-sm flex items-center gap-2 text-primary">
                      <Zap className="w-4 h-4" /> Axes d&apos;amélioration
                    </h5>
                    <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                      {qualityValues.length > 0 && avgQuality < 80 && <li>Qualité de sommeil sous 80% en moyenne — visez un coucher régulier</li>}
                      {hrvTrend < 0 && <li>HRV en baisse — surveillez votre charge d&apos;entraînement</li>}
                      <li>Hydratation : maintenez un apport régulier tout au long de la journée</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </>
          )}
        </Tabs>
      </main>
    </div>
  )
}
