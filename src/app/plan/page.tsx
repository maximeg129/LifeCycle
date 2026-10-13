"use client"

// Plan — destination top-level (refonte UI/IA, LifeCycle_Pro_UX_Engine_
// Review.md §3.1/3.5 : "Plan : Full plan page (not a modal)... Replaces
// Plan modal"). Contenu extrait du Sheet qui vivait jusqu'ici dans
// training-plan-tab.tsx — voir plan-tab.tsx pour le détail complet
// (progression, "Pourquoi ce plan ?", vigilance, grille 12 semaines,
// prévu/réalisé, journal des recalibrations).

import dynamic from 'next/dynamic'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

// Code-split : cette page porte toute la logique de génération/
// recalibration de plan (appels IA, grille complète) — jamais nécessaire
// au premier rendu d'Aujourd'hui (/cycling), qui n'importe plus ce module.
const PlanTab = dynamic(() => import('@/components/cycling/plan-tab').then(m => m.PlanTab), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
})

export default function PlanPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
        <AppNavigation />
        <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
          <PageHeader category="Entraînement" title="Plan" description="Objectif, phases, prévu vs réalisé." />
          <PlanTab />
        </main>
      </div>
    </AuthGuard>
  )
}
