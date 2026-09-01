"use client"

// Coach — tout ce qui concerne planifier, faire et relire une sortie, plus
// la relation avec le coach IA lui-même. Nouvelle destination de nav issue
// de la refonte IA (voir CLAUDE.md section Navigation), qui remplace
// l'ancien onglet "Coaching" de Cyclisme ET l'ancienne page /weather :
// planifier une sortie avec la bonne intensité (Proposition du jour) et
// planifier une sortie avec la bonne tenue (Météo & Tenue) sont le même
// geste, ça n'avait pas de sens que ce soit deux destinations différentes.
// /weather redirige ici (next.config.ts). Onglet "Plan" (voir CoachTabs
// ci-dessous) : Proposition du jour a fusionné dedans — retour utilisateur
// "la structure complète de la page coach est peut-être compliquée", une
// fois le plan daté par jour (assignSessionDates) et la Proposition du
// jour devenue son ajustement au jour le jour (adjustedFromPlan), les
// garder comme deux onglets séparés n'avait plus de sens : 7 sous-onglets
// réduits à 6, "Plan" ouvre désormais sur "Aujourd'hui" avant le plan
// périodisé complet.

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, CloudSun, Target, MessageCircle, BrainCircuit, Library } from 'lucide-react'
import { useAthlete } from '@/hooks/use-intervals'
import { useGovernor } from '@/components/cycling/use-governor'
import { DailyWorkoutTab } from '@/components/cycling/daily-workout-tab'

// Code-split: seule DailyWorkoutTab (le contenu du haut de l'onglet "Plan",
// désormais l'onglet par défaut — le geste le plus fréquent) ship dans le
// bundle principal — les autres se chargent à la demande, y compris
// TrainingPlanTab (le bas de ce même onglet), qui charge donc dès l'ouverture
// de la page plutôt que réellement "à la demande" depuis la fusion des deux
// onglets — accepté, pas la peine d'en faire un import statique séparé pour
// si peu. Même logique que Cyclisme avant sa propre refonte (PLAN.md 2.4).
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
const CoachLibraryTab = dynamic(() => import('@/components/cycling/coach-library-tab').then(m => m.CoachLibraryTab), {
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
  const initialTab = searchParams.get('tab') === 'stella' ? 'stella' : 'plan'

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <TabsList className="bg-card/50 border border-border p-1 h-auto flex flex-wrap gap-1">
        <TabsTrigger value="plan" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Target className="w-3.5 h-3.5 mr-1.5" /> Plan
        </TabsTrigger>
        <TabsTrigger value="rides" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Activity className="w-3.5 h-3.5 mr-1.5" /> Journal
        </TabsTrigger>
        <TabsTrigger value="weather" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <CloudSun className="w-3.5 h-3.5 mr-1.5" /> Météo &amp; Tenue
        </TabsTrigger>
        <TabsTrigger value="stella" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Stella
        </TabsTrigger>
        <TabsTrigger value="memory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <BrainCircuit className="w-3.5 h-3.5 mr-1.5" /> Mémoire coach
        </TabsTrigger>
        <TabsTrigger value="library" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
          <Library className="w-3.5 h-3.5 mr-1.5" /> Bibliothèque
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rides" className="space-y-8">
        <RidesJournalTab isConfigured={athlete.isConfigured} athleteLoading={athlete.isLoading} />
      </TabsContent>
      <TabsContent value="weather" className="space-y-8">
        <WeatherOutfitTab />
      </TabsContent>
      {/* Retour utilisateur : "le plan d'entrainement ne devrais t il pas
          etre figé avec les seances par jour ?" — "Proposition du jour"
          est désormais l'ajustement au jour le jour du plan (voir
          daily-workout-recommendation-flow.ts, adjustedFromPlan), pas une
          fonctionnalité indépendante : deux onglets séparés pour la même
          notion de "mon plan" n'avait plus de sens. Fusionnés en un seul
          — "Aujourd'hui" (DailyWorkoutTab) au-dessus du plan périodisé
          complet (TrainingPlanTab), même geste mental que le reste de
          cette page (Coach = planifier/faire/relire une sortie). */}
      <TabsContent value="plan" className="space-y-8">
        <DailyWorkoutTab />
        <TrainingPlanTab />
      </TabsContent>
      <TabsContent value="stella" className="space-y-8">
        <StellaChatTab />
      </TabsContent>
      <TabsContent value="memory" className="space-y-8">
        <CoachMemoryTab governorStatus={governor.status} />
      </TabsContent>
      <TabsContent value="library" className="space-y-8">
        <CoachLibraryTab />
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
