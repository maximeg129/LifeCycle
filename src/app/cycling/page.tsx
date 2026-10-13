"use client"

// Cyclisme → "Aujourd'hui" — refonte UI/IA (LifeCycle_Pro_UX_Engine_
// Review.md §3.1/3.3) : cette page reste à l'URL /cycling (trop de liens/
// code existants pour la renommer sans bénéfice réel) mais EST désormais
// la destination "Aujourd'hui" de la nouvelle IA à 3 entrées — fusionne ce
// qui vivait ici (tuiles Vue d'ensemble, budget/gouverneur, PMC) avec ce
// qui vivait dans Coach > Aujourd'hui (séance du jour, 7 prochains jours —
// voir TrainingPlanTab, slimmé à cette seule responsabilité). Plan (grille
// complète, recalibration) et Activités (Journal, détail, graphes) sont
// désormais leurs propres destinations top-level (/plan, et pour l'instant
// /coach pour Activités — voir CLAUDE.md, cette dernière reste à
// reconstruire dans un chantier séparé).

import React from 'react'
import dynamic from 'next/dynamic'
import { format, subDays } from 'date-fns'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAthlete, useFitnessChart } from '@/hooks/use-intervals'
import { NotConfiguredBanner } from '@/components/cycling/not-configured-banner'
import { KJBudgetWidget } from '@/components/cycling/kj-budget-widget'
import { GovernorWidget } from '@/components/cycling/governor-widget'
import { useGovernor } from '@/components/cycling/use-governor'
import { PerformanceBento } from '@/components/cycling/performance-bento'
import { TrainingPlanTab } from '@/components/cycling/training-plan-tab'

// Code-split: PMC pulls in Recharts, which nothing else on this page needs.
// See PLAN.md 2.4 — cycling used to be the single heaviest page in the app
// before its tabs were split out; merging PMC back into the main scroll
// (no more tab click) keeps that benefit by still loading it as its own
// chunk, just eagerly instead of gated behind a click.
const PmcTab = dynamic(() => import('@/components/cycling/pmc-tab').then(m => m.PmcTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})

// ── Date ranges ──────────────────────────────────────────────────────

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const fitnessOldest = format(subDays(today, 84), 'yyyy-MM-dd') // 12 semaines

// ── Loading skeleton ─────────────────────────────────────────────────

function FitnessCardSkeleton() {
  return (
    <Card className="bg-card/40 border-border">
      <CardContent className="py-6 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

// ── Main page ────────────────────────────────────────────────────────

export default function CyclingHub() {
  const athlete = useAthlete()
  const fitness = useFitnessChart(fitnessOldest, newest)
  const governor = useGovernor()

  const isConfigured = athlete.isConfigured

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      {/* No PageHeader on this page anymore — retour utilisateur : le bloc
          "Performance / LifeCycle Vault" faisait doublon avec le header
          mobile fixe + la sidebar desktop, qui disent déjà "LifeCycle" et
          surlignent "Aujourd'hui" comme page active. pt-20 (au lieu du p-4
          habituel) remplace la clearance mobile que PageHeader apportait
          via son propre mt-16, pour ne pas passer sous le header fixe. */}
      <main className="px-4 pt-20 pb-4 md:p-8 max-w-7xl mx-auto space-y-8">
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
              <PerformanceBento athlete={athlete.data} fitnessSeries={fitness.data} />
            ) : athlete.error ? (
              <Card className="bg-card/40 border-border">
                <CardContent className="py-8 text-center text-sm text-destructive">
                  Erreur : {athlete.error}
                </CardContent>
              </Card>
            ) : null}

            {/* Séance du jour + 7 prochains jours (refonte UI/IA — voir le
                commentaire de tête de ce fichier) : le "Plan header" une
                ligne, puis la séance du jour elle-même, puis la fenêtre
                glissante. Rendu même sans connexion Intervals.icu — ses
                propres sous-composants gèrent déjà chacun leur dégradation
                (voir IntervalsOnboardingNotice à l'intérieur). */}
            <TrainingPlanTab />

            {/* kJ budget + internal load governor — real mechanical work, not TSS/rigid plan */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KJBudgetWidget governorStatus={governor.status} />
              <GovernorWidget />
            </section>

            {/* PMC — courbe de tendance 12 semaines, charge hebdo, records de puissance (Riegel) */}
            <PmcTab isConfigured={isConfigured} athleteLoading={athlete.isLoading} fitness={fitness} />
          </>
        )}
      </main>
    </div>
    </AuthGuard>
  )
}
