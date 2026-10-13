"use client"

// Coach → "Activités" — refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md
// §3.1/3.4) : cette page reste à l'URL /coach (trop de liens/deep-links
// existants — ?tab=memory/library, le bouton flottant Stella — pour la
// renommer sans bénéfice réel) mais EST désormais la destination
// "Activités" de la nouvelle IA à 3 entrées (Aujourd'hui/Plan/Activités).
// "Aujourd'hui" (ex-premier onglet, `TrainingPlanTab`) a déménagé sur
// /cycling — voir CLAUDE.md et le commentaire de tête de ce fichier côté
// cycling/page.tsx — donc le premier onglet ici redevient Journal, le
// cœur de cette destination (sorties + détail + analyse). Météo & Tenue et
// le menu "Plus" (Mémoire coach/Bibliothèque) restent inchangés.
// Reconstruction complète de cet écran (détail activité, filtres, charts —
// voir LifeCycle_Pro_UI_Spec.md §Activités) différée à un chantier séparé,
// voir CLAUDE.md.

import { Suspense, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Activity, CloudSun, BrainCircuit, Library, MoreHorizontal } from 'lucide-react'
import { useAthlete } from '@/hooks/use-intervals'
import { useGovernor } from '@/components/cycling/use-governor'

const RidesJournalTab = dynamic(() => import('@/components/coach/rides-journal-tab').then(m => m.RidesJournalTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const WeatherOutfitTab = dynamic(() => import('@/components/coach/weather-outfit-tab').then(m => m.WeatherOutfitTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const CoachMemoryTab = dynamic(() => import('@/components/cycling/coach-memory-tab').then(m => m.CoachMemoryTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const CoachLibraryTab = dynamic(() => import('@/components/cycling/coach-library-tab').then(m => m.CoachLibraryTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})

// Stella est sortie de la TabsList il y a déjà un moment — "je garderais
// Stella en bouton flottant" — remplacée par l'overlay flottant de
// sidebar.tsx (StellaChatTab n'est donc jamais importé ici). "today" a
// quitté VALID_TABS avec ce chantier (son contenu vit sur /cycling) — le
// premier onglet valide/par défaut redevient "rides" (Journal).
const VALID_TABS = ['rides', 'weather', 'memory', 'library'] as const
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
  const initialTab: CoachTab = (VALID_TABS as readonly string[]).includes(paramTab ?? '') ? (paramTab as CoachTab) : 'rides'
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
          <TabsTrigger value="rides" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Journal
          </TabsTrigger>
          <TabsTrigger value="weather" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
            <CloudSun className="w-3.5 h-3.5 mr-1.5" /> Météo &amp; Tenue
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

      {/* No PageHeader on cette page — retour utilisateur : le bandeau
          "Coaching IA / Coach" fait doublon avec la sidebar desktop + la
          bottom nav mobile, qui surlignent déjà "Activités" comme page
          active (pathname exact match, voir sidebar.tsx). pt-20 (au lieu du
          p-4 habituel) remplace la clearance mobile que PageHeader
          apportait via son propre mt-16 — même traitement qu'Aujourd'hui. */}
      <main className="px-4 pt-20 pb-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg" />}>
          <CoachTabs />
        </Suspense>
      </main>
    </div>
    </AuthGuard>
  )
}
