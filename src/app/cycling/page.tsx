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
//
// Restructuration (lifecycle-ui-reference.html, retour utilisateur captures
// d'écran "en jaune la section doit se limiter seulement a ces indicateurs
// ... en rouge le plan pour le semaine (simplifié)") : cette page ne garde
// plus que la salutation (TodayGreeting, rendue DANS TrainingPlanTab — voir
// son commentaire de tête — côte à côte avec le header "Semaine N/T..."),
// le panneau ReadinessStrip (via PerformanceBento) et la séance du jour/7
// prochains jours (TrainingPlanTab) — la grille "Entraînement" (Riegel/CTL/
// ATL/FTP/Puissance critique) a été retirée de PerformanceBento, et le
// budget kJ/gouverneur/PMC ont déménagé vers /plan (voir plan-tab.tsx),
// confirmés par AskUserQuestion avant ce retrait.

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAthlete } from '@/hooks/use-intervals'
import { NotConfiguredBanner } from '@/components/cycling/not-configured-banner'
import { PerformanceBento } from '@/components/cycling/performance-bento'
import { TrainingPlanTab } from '@/components/cycling/training-plan-tab'

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
            {/* ReadinessStrip — panneau "Aujourd'hui" (Forme/Récupération/
                Sommeil/HRV·FC). La grille "Entraînement" (Riegel/CTL/ATL/
                FTP/Puissance critique) a été retirée de cette page — voir
                le commentaire de tête du fichier. */}
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

            {/* Séance du jour + 7 prochains jours (refonte UI/IA — voir le
                commentaire de tête de ce fichier) : le "Plan header" une
                ligne, puis la séance du jour elle-même, puis la fenêtre
                glissante. Rendu même sans connexion Intervals.icu — ses
                propres sous-composants gèrent déjà chacun leur dégradation
                (voir IntervalsOnboardingNotice à l'intérieur). */}
            <TrainingPlanTab />
          </>
        )}
      </main>
    </div>
    </AuthGuard>
  )
}
