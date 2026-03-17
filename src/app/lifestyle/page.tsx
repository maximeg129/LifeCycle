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
  Droplets,
  Sun,
  Clock,
  Brain,
  ThermometerSun
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'

const sleepData = [
  { day: 'Lun', hours: 7.2, quality: 82 },
  { day: 'Mar', hours: 6.8, quality: 74 },
  { day: 'Mer', hours: 7.5, quality: 88 },
  { day: 'Jeu', hours: 8.1, quality: 92 },
  { day: 'Ven', hours: 7.0, quality: 79 },
  { day: 'Sam', hours: 8.4, quality: 95 },
  { day: 'Dim', hours: 7.8, quality: 87 },
]

const hrvData = [
  { day: 'Lun', hrv: 62 },
  { day: 'Mar', hrv: 58 },
  { day: 'Mer', hrv: 65 },
  { day: 'Jeu', hrv: 71 },
  { day: 'Ven', hrv: 64 },
  { day: 'Sam', hrv: 73 },
  { day: 'Dim', hrv: 68 },
]

const weeklyMood = [
  { day: 'Lun', score: 7 },
  { day: 'Mar', score: 6 },
  { day: 'Mer', score: 8 },
  { day: 'Jeu', score: 9 },
  { day: 'Ven', score: 7 },
  { day: 'Sam', score: 9 },
  { day: 'Dim', score: 8 },
]

export default function LifestylePage() {
  const [activeTab, setActiveTab] = useState('overview')

  const metrics = [
    { icon: Moon, label: "Sommeil", value: "7h 24m", subtitle: "Qualité : 85%", color: "text-indigo-500", bg: "bg-indigo-500/10", progress: 85 },
    { icon: Activity, label: "HRV", value: "68 ms", subtitle: "Récupération optimale", color: "text-red-500", bg: "bg-red-500/10", progress: 78 },
    { icon: Smile, label: "Stress", value: "Bas", subtitle: "Score : 25/100", color: "text-yellow-500", bg: "bg-yellow-500/10", progress: 25 },
    { icon: Zap, label: "Readiness", value: "92/100", subtitle: "Prêt pour l'effort", color: "text-orange-500", bg: "bg-orange-500/10", progress: 92 },
  ]

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Bien-être</h2>
            <h1 className="text-3xl font-bold">Vie & Santé</h1>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-4 py-1.5 text-xs font-bold border-primary/20 text-primary bg-primary/5">
            <HeartPulse className="w-3.5 h-3.5 mr-2" /> Dernière sync : aujourd'hui
          </Badge>
        </header>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="overview" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Zap className="w-4 h-4 mr-2" /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="sleep" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Moon className="w-4 h-4 mr-2" /> Sommeil
            </TabsTrigger>
            <TabsTrigger value="recovery" className="px-8 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Activity className="w-4 h-4 mr-2" /> Récupération
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((m) => (
                <Card key={m.label} className="apple-card border-none p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", m.bg)}>
                      <m.icon className={cn("w-5 h-5", m.color)} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</span>
                  </div>
                  <div className="text-3xl font-bold tracking-tight mb-2">{m.value}</div>
                  <p className="text-xs text-muted-foreground mb-4">{m.subtitle}</p>
                  <Progress value={m.progress} className="h-1.5" />
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" /> Humeur de la semaine
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyMood}>
                      <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 10]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#moodGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="apple-card border-none p-8">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-500" /> HRV — 7 derniers jours
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hrvData}>
                      <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis domain={[40, 90]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                      <Line type="monotone" dataKey="hrv" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ fill: "hsl(0 84% 60%)", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Conseils du jour</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: Sun, title: "Lumière matinale", desc: "Exposez-vous à la lumière naturelle dans les 30 min après le réveil.", color: "text-yellow-500", bg: "bg-yellow-500/10" },
                    { icon: Droplets, title: "Hydratation", desc: "Objectif : 2.5L aujourd'hui. Ajoutez 500ml post-entraînement.", color: "text-blue-500", bg: "bg-blue-500/10" },
                    { icon: ThermometerSun, title: "Séance idéale", desc: "Votre readiness est haute — placez un effort d'intensité Z4/Z5.", color: "text-orange-500", bg: "bg-orange-500/10" },
                  ].map((tip) => (
                    <div key={tip.title} className="p-6 rounded-2xl bg-secondary/30 space-y-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tip.bg)}>
                        <tip.icon className={cn("w-5 h-5", tip.color)} />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Moyenne</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">7h 33m</div>
                <p className="text-xs text-muted-foreground mt-1">sur 7 jours</p>
              </Card>
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Qualité Moy.</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">85%</div>
                <p className="text-xs text-muted-foreground mt-1">+3% vs semaine précédente</p>
              </Card>
              <Card className="apple-card border-none p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Régularité</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">23h14</div>
                <p className="text-xs text-muted-foreground mt-1">Heure moyenne de coucher</p>
              </Card>
            </div>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Moon className="w-5 h-5 text-indigo-500" /> Durée & qualité de sommeil
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sleepData}>
                    <defs>
                      <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(240 60% 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(240 60% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                    <Area type="monotone" dataKey="hours" stroke="hsl(240 60% 60%)" fill="url(#sleepGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Détail par nuit</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-3">
                  {sleepData.map((night) => (
                    <div key={night.day} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30">
                      <span className="font-bold text-sm w-12">{night.day}</span>
                      <div className="flex-1 mx-6">
                        <Progress value={night.quality} className="h-2" />
                      </div>
                      <span className="text-sm font-bold w-16 text-right">{night.hours}h</span>
                      <Badge variant="outline" className={cn(
                        "ml-4 rounded-full text-[10px] font-bold border-none px-3",
                        night.quality >= 85 ? "bg-green-500/10 text-green-500" :
                        night.quality >= 70 ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-red-500/10 text-red-500"
                      )}>
                        {night.quality}%
                      </Badge>
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
              <CardContent className="p-0 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrvData}>
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[40, 90]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                    <Line type="monotone" dataKey="hrv" stroke="hsl(0 84% 60%)" strokeWidth={2.5} dot={{ fill: "hsl(0 84% 60%)", r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="apple-card border-none p-8">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-lg font-bold tracking-tight">Analyse de la Récupération</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Votre sommeil a été particulièrement réparateur ces 3 dernières nuits. Votre HRV est en tendance haussière (+8% cette semaine). C'est le moment idéal pour placer une séance d'entraînement de haute intensité.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-2">
                    <h5 className="font-bold text-sm flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-4 h-4" /> Points forts
                    </h5>
                    <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                      <li>Régularité du coucher excellente</li>
                      <li>Phases de sommeil profond en progression</li>
                      <li>HRV au-dessus de votre baseline</li>
                    </ul>
                  </div>
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl space-y-2">
                    <h5 className="font-bold text-sm flex items-center gap-2 text-primary">
                      <Zap className="w-4 h-4" /> Axes d'amélioration
                    </h5>
                    <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                      <li>Maintenez votre heure de coucher régulière</li>
                      <li>Hydratation : buvez 500ml d'eau supplémentaire</li>
                      <li>Exposition lumière naturelle dès le réveil</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
