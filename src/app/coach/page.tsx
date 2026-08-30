"use client"

// Coach — tout ce qui concerne planifier, faire et relire une sortie, plus
// la relation avec le coach IA lui-même. Nouvelle destination de nav issue
// de la refonte IA (voir CLAUDE.md section Navigation), qui remplace
// l'ancien onglet "Coaching" de Cyclisme ET l'ancienne page /weather :
// planifier une sortie avec la bonne intensité (Proposition du jour) et
// planifier une sortie avec la bonne tenue (Météo & Tenue) sont le même
// geste, ça n'avait pas de sens que ce soit deux destinations différentes.
// /weather redirige ici (next.config.ts).

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Activity, CloudSun, Target, MessageCircle, BrainCircuit } from 'lucide-react'
import { useAthlete } from '@/hooks/use-intervals'
import { useGovernor } from '@/components/cycling/use-governor'
import { DailyWorkoutTab } from '@/components/cycling/daily-workout-tab'

// Code-split: seule "Proposition du jour" (l'onglet par défaut, le geste le
// plus fréquent) ship dans le bundle principal — les 5 autres se chargent à
// la demande. Même logique que Cyclisme avant sa propre refonte (PLAN.md 2.4).
const RidesJournalTab = dynamic(() => import('@/components/coach/rides-journal-tab').then(m => m.RidesJournalTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const WeatherOutfitTab = dynamic(() => import('@/components/coach/weather-outfit-tab').then(m => m.WeatherOutfitTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const TrainingPlanTab = dynamic(() => import('@/components/cycling/training-plan-tab').then(m => m.TrainingPlanTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const StellaChatTab = dynamic(() => import('@/components/cycling/stella-chat-tab').then(m => m.StellaChatTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const CoachMemoryTab = dynamic(() => import('@/components/cycling/coach-memory-tab').then(m => m.CoachMemoryTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})

// Lit ?tab=stella (bouton flottant Stella de la nav mobile — sidebar.tsx)
// pour ouvrir directement le sous-onglet Stella. useSearchParams() exige
// sa propre limite Suspense pour ne pas faire basculer toute la page en
// rendu client pur.
function CoachTabs() {
  const athlete = useAthlete()
  const governor = useGovernor()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'stella' ? 'stella' : 'daily-workout'

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <TabsList className="bg-card/50 border border-border p-1 h-auto flex flex-wrap gap-1">
        <TabsTrigger value="daily-workout" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Proposition du jour
        </TabsTrigger>
        <TabsTrigger value="rides" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Activity className="w-3.5 h-3.5 mr-1.5" /> Sorties
        </TabsTrigger>
        <TabsTrigger value="weather" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <CloudSun className="w-3.5 h-3.5 mr-1.5" /> Météo &amp; Tenue
        </TabsTrigger>
        <TabsTrigger value="plan" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Target className="w-3.5 h-3.5 mr-1.5" /> Plan
        </TabsTrigger>
        <TabsTrigger value="stella" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Stella
        </TabsTrigger>
        <TabsTrigger value="memory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> Mémoire coach
        </TabsTrigger>
      </TabsList>

      <TabsContent value="daily-workout" className="space-y-8">
        <DailyWorkoutTab />
      </TabsContent>
      <TabsContent value="rides" className="space-y-8">
        <RidesJournalTab isConfigured={athlete.isConfigured} athleteLoading={athlete.isLoading} />
      </TabsContent>
      <TabsContent value="weather" className="space-y-8">
        <WeatherOutfitTab />
      </TabsContent>
      <TabsContent value="plan" className="space-y-8">
        <TrainingPlanTab />
      </TabsContent>
      <TabsContent value="stella" className="space-y-8">
        <StellaChatTab />
      </TabsContent>
      <TabsContent value="memory" className="space-y-8">
        <CoachMemoryTab governorStatus={governor.status} />
      </TabsContent>
    </Tabs>
  )
}

export default function CoachPage() {
  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader category="Coaching IA" title="Coach" />

        <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg" />}>
          <CoachTabs />
        </Suspense>
      </main>
    </div>
    </AuthGuard>
  )
}
