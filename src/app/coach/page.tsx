"use client"

// Coach — tout ce qui concerne planifier, faire et relire une sortie, plus
// la relation avec le coach IA lui-même. Nouvelle destination de nav issue
// de la refonte IA (voir CLAUDE.md section Navigation), qui remplace
// l'ancien onglet "Coaching" de Cyclisme ET l'ancienne page /weather :
// planifier une sortie avec la bonne intensité (Proposition du jour) et
// planifier une sortie avec la bonne tenue (Météo & Tenue) sont le même
// geste, ça n'avait pas de sens que ce soit deux destinations différentes.
// /weather redirige ici (next.config.ts).
//
// "Aujourd'hui" et "Plan" — deux onglets séparés, PAS fusionnés. Ça l'ont
// été un temps (voir CLAUDE.md "Page Coach restructurée : 7 → 6
// sous-onglets") : une fois le plan daté par jour et la Proposition du
// jour devenue son ajustement au jour le jour, garder deux onglets pour la
// même notion de "mon plan" ne semblait plus avoir de sens. Retour
// utilisateur après usage réel, une fois le plan périodisé lui-même devenu
// un vrai écran de gestion (vue calendrier, badge de vigilance, journal des
// recalibrations) : "je reste vraiment pas sûre d'avoir le côté plan et
// séances du jour sur le même onglet." Analyse (voir CLAUDE.md) : le vrai
// distinguo n'est pas "plan vs séance du jour", c'est "coup d'œil quotidien
// vs écran de gestion occasionnel" — exactement la distinction que
// TrainerRoad fait entre son écran "Career" et son "Calendar" séparé.
// Redéfusionnés : "Aujourd'hui" (bandeau à traiter + `DailyWorkoutTab`)
// reste l'onglet par défaut ; "Plan" (le plan périodisé complet,
// `TrainingPlanTab`) redevient sa propre destination.

import { Suspense, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Activity, CloudSun, Sun, Target, MessageCircle, BrainCircuit, Library, MoreHorizontal } from 'lucide-react'
import { useAthlete } from '@/hooks/use-intervals'
import { useGovernor } from '@/components/cycling/use-governor'
import { DailyWorkoutTab } from '@/components/cycling/daily-workout-tab'
import { PendingFeedbackBanner } from '@/components/coach/pending-feedback-banner'

// Code-split: seule DailyWorkoutTab (le contenu de l'onglet "Aujourd'hui",
// l'onglet par défaut — le geste le plus fréquent) ship dans le bundle
// principal — les autres se chargent à la demande, y compris
// TrainingPlanTab, qui charge réellement à la demande maintenant que
// "Plan" est redevenu son propre onglet séparé (voir le commentaire en
// tête de fichier — ça ne l'était plus tant qu'il partageait le même
// TabsContent qu'Aujourd'hui). Même logique que Cyclisme avant sa propre
// refonte (PLAN.md 2.4).
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

const VALID_TABS = ['today', 'plan', 'rides', 'weather', 'stella', 'memory', 'library'] as const
type CoachTab = (typeof VALID_TABS)[number]

// Lit ?tab=... (bouton flottant Stella de la nav mobile — sidebar.tsx —
// utilise ?tab=stella, mais n'importe quel onglet valide peut être
// deep-lié de la même façon) pour ouvrir directement un sous-onglet.
// useSearchParams() exige sa propre limite Suspense pour ne pas faire
// basculer toute la page en rendu client pur.
function CoachTabs() {
  const athlete = useAthlete()
  const governor = useGovernor()
  const searchParams = useSearchParams()
  const paramTab = searchParams.get('tab')
  const initialTab: CoachTab = (VALID_TABS as readonly string[]).includes(paramTab ?? '') ? (paramTab as CoachTab) : 'today'
  const [tab, setTab] = useState<CoachTab>(initialTab)

  // Retour utilisateur : "nous devrions peut être effectuer un audit...
  // des applications compétitrices" (COACH_UX_AUDIT.md §4.D) — aucun des 3
  // concurrents examinés (Join, Frive, TrainerRoad) ne met un écran de
  // configuration (mémoire/bibliothèque de sources) au même niveau de nav
  // qu'un écran d'usage quotidien (Plan/Journal). Mémoire coach et
  // Bibliothèque restent de vrais onglets (même valeur, même TabsContent —
  // rien ne change côté deep-link ?tab=memory/library) mais leur déclencheur
  // sort de la TabsList pour un menu "Plus", démoté visuellement. Tabs
  // devient contrôlé (value/onValueChange) pour que ce menu puisse changer
  // l'onglet actif sans être lui-même un TabsTrigger Radix.
  const isSecondaryTab = tab === 'memory' || tab === 'library'

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as CoachTab)} className="space-y-6">
      <div className="flex items-center gap-1 flex-wrap">
        <TabsList className="bg-card/50 border border-border p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="today" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
            <Sun className="w-3.5 h-3.5 mr-1.5" /> Aujourd&apos;hui
          </TabsTrigger>
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
        </TabsList>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('gap-1.5 text-sm px-3 py-1.5 h-auto', isSecondaryTab && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground')}
            >
              <MoreHorizontal className="w-3.5 h-3.5" /> Plus
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setTab('memory')} className="gap-2">
              <BrainCircuit className="w-4 h-4" /> Mémoire coach
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTab('library')} className="gap-2">
              <Library className="w-4 h-4" /> Bibliothèque
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TabsContent value="rides" className="space-y-8">
        <RidesJournalTab isConfigured={athlete.isConfigured} athleteLoading={athlete.isLoading} />
      </TabsContent>
      <TabsContent value="weather" className="space-y-8">
        <WeatherOutfitTab />
      </TabsContent>
      {/* Retour utilisateur, après usage réel de la fusion Aujourd'hui+Plan
          (voir CLAUDE.md "Page Coach restructurée") : "je reste vraiment
          pas sûre d'avoir le côté plan et séances du jour sur le même
          onglet." Le plan périodisé est devenu un vrai écran de gestion
          (calendrier, badge de vigilance, journal des recalibrations) —
          plus léger de coup d'œil quotidien comme au moment de la fusion.
          "Aujourd'hui" (coup d'œil quotidien) et "Plan" (consultation
          occasionnelle) redeviennent deux onglets séparés. */}
      <TabsContent value="today" className="space-y-8">
        {/* Retour utilisateur, en validant COACH_UX_AUDIT.md §4.B (inspiré
            de Join, "Pending Feedback" card) : les sorties récentes sans
            RPE sont désormais surfacées ici plutôt que de compter sur
            l'athlète pour remarquer une icône non remplie dans le Journal. */}
        <PendingFeedbackBanner />
        <DailyWorkoutTab />
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
