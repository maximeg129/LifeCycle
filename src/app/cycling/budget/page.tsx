"use client"

// Détail du "Budget de la semaine" — retour utilisateur : "crées de sous page
// qui donne du détails, méthode de calcul, compréhension, composition" pour
// ce widget (repéré sur une capture d'écran, cerclé en vert avec le
// Gouverneur). Composite calculé en direct depuis les activités récentes
// (pas une métrique suivie jour par jour comme les tuiles Vue d'ensemble) —
// route dédiée plutôt que /cycling/metric/[id]. Le widget live est rendu ici
// tel quel (sans le lien vers cette page, pour ne pas boucler sur soi-même),
// suivi d'une explication fidèle à load-types.ts/use-kj-budget.ts — jamais
// une paraphrase approximative de ce que fait vraiment le calcul.

import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useKJBudget } from '@/components/cycling/use-kj-budget'
import { useGovernor } from '@/components/cycling/use-governor'

const trendIcon: Record<string, typeof TrendingUp> = { up: TrendingUp, down: TrendingDown, flat: Minus }

export default function BudgetDetailPage() {
  const governor = useGovernor()
  const budget = useKJBudget(governor.status)

  const TrendIcon = trendIcon[budget.trend.direction]
  const pct = budget.target > 0 ? Math.min(100, Math.round((budget.realized / budget.target) * 100)) : 0

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/cycling" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à Cyclisme
        </Link>

        <PageHeader
          category="Entraînement"
          title="Budget de la semaine"
          description="Travail mécanique réel (puissance × durée), pas un TSS pondéré arbitrairement"
        />

        {budget.isLoading ? (
          <Card className="bg-card/40 border-border">
            <CardContent className="py-6 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ) : (
          <MetricCard
            title="Budget de la semaine"
            description="Travail mécanique réel (puissance × durée), pas un TSS pondéré arbitrairement"
            icon={Flame}
            isAvailable={budget.isAvailable}
            requiredInputs={["Puissance (watts) enregistrée sur au moins une séance récente"]}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{budget.realized}</span>
              <span className="text-lg text-muted-foreground">/ {budget.target || '—'} kJ</span>
            </div>
            <Progress value={pct} className="h-1.5 mt-3" />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Base 8 sem. : {budget.baseline || '—'} kJ</span>
              {budget.trend.direction !== 'flat' ? (
                <span className={`flex items-center gap-1 ${budget.trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                  <TrendIcon className="w-3 h-3" /> {budget.trend.pctChange > 0 ? '+' : ''}{budget.trend.pctChange}% / 8 sem.
                </span>
              ) : (
                <span className="flex items-center gap-1"><Minus className="w-3 h-3" /> Stable</span>
              )}
            </div>
          </MetricCard>
        )}

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Méthode de calcul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">kJ d&apos;une séance</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Watts moyens de la séance × durée en mouvement (secondes), divisé par 1000. C&apos;est du travail
                mécanique réel — pas un score pondéré comme le TSS, qui suppose des relations puissance/effort
                fixées à l&apos;avance. Une séance sans capteur de puissance ne compte pas dans le budget (elle
                n&apos;a pas de watts moyens exploitables).
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Réalisé</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Somme des kJ de toutes les séances avec puissance depuis le lundi de la semaine en cours.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Référence (base 8 sem.)</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Moyenne des kJ hebdomadaires des 8 dernières semaines complètes (semaines avec au moins une
                séance avec puissance). Une semaine en cours ou sans donnée exploitable n&apos;entre pas dans
                cette moyenne.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Objectif de la semaine</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Dérivé de la référence selon l&apos;état du <Link href="/cycling/governor" className="text-primary hover:underline">gouverneur de charge interne</Link> :
                <span className="font-medium text-foreground"> Favorable</span> (🟢) autorise +8% par rapport à
                la référence, <span className="font-medium text-foreground">Dégradé</span> (🔴) la réduit de
                12%, <span className="font-medium text-foreground">Stable</span> (🟠) et
                <span className="font-medium text-foreground"> Données insuffisantes</span> (⚪) la maintiennent
                telle quelle. Le budget ne progresse donc jamais "à l&apos;aveugle" — l&apos;augmentation dépend
                de signaux de récupération favorables, pas seulement d&apos;une progression planifiée dans le temps.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Tendance</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Compare la moyenne de la première moitié des 8 dernières semaines complètes à celle de la
                seconde moitié. Un écart de plus de 5% dans un sens ou l&apos;autre affiche une flèche
                (hausse/baisse) ; en dessous, la charge est considérée stable. Calcul nécessite au moins 4
                semaines complètes de données.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
