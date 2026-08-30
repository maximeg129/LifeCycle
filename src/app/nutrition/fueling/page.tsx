"use client"

// Détail du widget "Fueling vs Workload" — retour utilisateur : "Vérifie les
// données de cette tuile, et donne accès à plus de détails en cliquant
// dessus." Composite calculé en direct depuis les activités du jour et le
// Journal du Jour (pas une métrique suivie jour par jour) — route dédiée
// plutôt que /cycling/metric/[id], même convention que /cycling/budget et
// /cycling/governor. Le widget live est rendu ici tel quel (sans le lien
// vers cette page, pour ne pas boucler sur soi-même), suivi d'une
// explication fidèle à fueling-types.ts.
//
// La vérification a trouvé un vrai bug, corrigé au passage (voir
// intervals-api.ts / bestAverageWatts()) : "Brûlé" utilisait la puissance
// normalisée (icu_weighted_avg_watts) plutôt que la puissance moyenne réelle
// pour le calcul kJ≈kcal — gonflant systématiquement le nombre affiché sur
// toute sortie à intensité variable (fractionné, bosses, group ride).

import { useMemo } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, Flame, UtensilsCrossed, Scale, Beef } from 'lucide-react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAthlete, useActivities } from '@/hooks/use-intervals'
import { useNutritionData } from '@/components/nutrition/use-nutrition-data'
import { totalEnergyBurnedKcal, recoveryGap, proteinTargetRange } from '@/components/nutrition/fueling-types'

export default function FuelingDetailPage() {
  const athlete = useAthlete()
  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const activities = useActivities(todayId, todayId)
  const nutrition = useNutritionData()

  const weightKg = athlete.data?.weight ?? null
  const isAvailable = weightKg != null && weightKg > 0
  const isLoading = athlete.isLoading || activities.isLoading || nutrition.isLoading

  const burned = useMemo(() => totalEnergyBurnedKcal(activities.data, weightKg), [activities.data, weightKg])
  const eaten = nutrition.totals.calories
  const gap = recoveryGap(eaten, burned)
  const protein = weightKg ? proteinTargetRange(weightKg) : null

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/nutrition" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à Nutrition
        </Link>

        <PageHeader
          category="Nutrition & Fueling"
          title="Fueling vs Workload"
          description="Équilibre énergie brûlée / mangée, sur la base de votre poids Intervals.icu"
        />

        {isLoading ? (
          <Card className="bg-card/40 border-border">
            <CardContent className="py-6"><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        ) : (
          <MetricCard
            title="Fueling vs Workload"
            description="Équilibre énergie brûlée / mangée, sur la base de votre poids Intervals.icu"
            icon={Flame}
            isAvailable={isAvailable}
            requiredInputs={["Poids corporel renseigné sur votre profil Intervals.icu"]}
            ctaLabel="Configurer Intervals.icu"
            ctaHref="/settings"
          >
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" /> Brûlé
                </div>
                <div className="text-2xl font-bold">{burned}</div>
                <div className="text-[10px] text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-green-400" /> Mangé
                </div>
                <div className="text-2xl font-bold">{eaten}</div>
                <div className="text-[10px] text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Scale className="w-3.5 h-3.5 text-primary" /> Écart
                </div>
                <div className={`text-2xl font-bold ${gap < 0 ? 'text-red-400' : 'text-green-400'}`}>{gap > 0 ? '+' : ''}{gap}</div>
                <div className="text-[10px] text-muted-foreground">kcal récup.</div>
              </div>
            </div>

            {protein && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5"><Beef className="w-3.5 h-3.5" /> Cible protéines du jour</span>
                  <span>{nutrition.totals.protein}g / {protein.min}-{protein.max}g</span>
                </div>
                <Progress value={Math.min(100, Math.round((nutrition.totals.protein / protein.max) * 100))} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1">1.6-2.0 g/kg, basé sur {weightKg} kg (Intervals.icu)</p>
              </div>
            )}
          </MetricCard>
        )}

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Méthode de calcul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Brûlé</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Somme de l&apos;énergie dépensée sur les activités Intervals.icu du jour uniquement — ce n&apos;est
                pas votre dépense totale (elle n&apos;inclut pas le métabolisme de base). Pour une sortie avec
                capteur de puissance : kJ de travail mécanique réel (puissance moyenne × durée), converti en kcal
                via la règle empirique kJ ≈ kcal (rendement brut d&apos;environ 23% et la conversion kJ→kcal se
                compensent presque exactement). Sans capteur de puissance : estimation durée × MET (selon
                l&apos;intensité Intervals.icu) × poids corporel.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Mangé</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Total des calories du Journal du Jour (onglet Aujourd&apos;hui), mis à jour au fil de vos repas
                loggés.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Écart</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Mangé − Brûlé (uniquement l&apos;énergie de l&apos;entraînement du jour, pas votre dépense totale).
                Un écart positif ne veut donc pas dire "excédent calorique de la journée" — il indique que vous
                avez mangé plus que ce que la séance du jour a coûté en travail mécanique, une marge pour la
                récupération plutôt qu&apos;un vrai bilan énergétique quotidien.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Cible protéines du jour</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                1.6 à 2.0 g de protéines par kg de poids de corps (poids Intervals.icu) — la fourchette
                habituellement recommandée pour un sportif d&apos;endurance, pas un chiffre unique arbitraire.
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                ⚠️ Correctif appliqué à cette tuile suite à une vérification demandée par l&apos;utilisateur : "Brûlé"
                utilisait par erreur la puissance normalisée (icu_weighted_avg_watts, qui pondère les efforts
                intenses) plutôt que la puissance moyenne réelle pour ce calcul kJ≈kcal — la puissance normalisée
                est par construction toujours ≥ la puissance moyenne sur une sortie à intensité variable
                (fractionné, bosses), donc le nombre affiché était systématiquement gonflé sur ce type de sortie.
                Corrigé dans <code>bestAverageWatts()</code> (<code>intervals-api.ts</code>), qui alimente aussi le
                Budget kJ de la semaine — même correctif, même bénéfice là-bas.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
