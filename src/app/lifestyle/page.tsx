"use client"

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HeartPulse, Moon, Zap, Smile, Activity } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export default function LifestylePage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HeartPulse className="w-8 h-8 text-red-500" /> Vie & Santé
          </h1>
          <p className="text-muted-foreground">Bien-être, sommeil et récupération globale.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Moon className="w-3 h-3 text-indigo-500" /> Sommeil (Nuit)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">7h 24m</div>
              <p className="text-[10px] text-accent mt-2">Qualité : 85%</p>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Activity className="w-3 h-3 text-red-500" /> HRV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">68 ms</div>
              <p className="text-[10px] text-accent mt-2">Récupération optimale</p>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Smile className="w-3 h-3 text-yellow-500" /> Stress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">Bas</div>
              <Progress value={25} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <Zap className="w-3 h-3 text-orange-500" /> Readiness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">92/100</div>
              <Progress value={92} className="h-1.5 mt-2 bg-orange-500/10" />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/40 border-border">
          <CardHeader>
            <CardTitle>Analyse de la Récupération</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Votre sommeil a été particulièrement réparateur ces 3 dernières nuits. C'est le moment idéal pour placer une séance d'entraînement de haute intensité.
            </p>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <h5 className="font-bold text-sm mb-2">Conseils d'hygiène de vie</h5>
              <ul className="text-xs space-y-2 list-disc pl-4">
                <li>Maintenez votre heure de coucher régulière.</li>
                <li>Hydratation : essayez de boire 500ml d'eau supplémentaire aujourd'hui.</li>
                <li>Exposition à la lumière du jour dès le réveil.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
