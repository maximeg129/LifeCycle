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
//
// Deuxième retour utilisateur, sur cette même tuile : "Il faudrait d'une
// façon différenciée ajouter le métabolisme de base et séparer les calories
// brûlées au sport." Avant ce correctif, "Brûlé" ne comptait QUE l'énergie
// des activités du jour — jamais le métabolisme de base (BMR) — donc
// l'Écart affiché n'était pas un vrai bilan énergétique quotidien. Sport et
// Métabolisme sont maintenant deux chiffres distincts (BiometricsCard fait
// tourner Mifflin-St Jeor à partir d'une saisie manuelle taille/âge/sexe,
// puisqu'Intervals.icu ne fournit que le poids) et l'Écart se base sur leur
// somme dès que le métabolisme est configuré.

import { useMemo } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, Flame, UtensilsCrossed, Scale, Beef, Activity as ActivityIcon } from 'lucide-react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAthlete, useActivities } from '@/hooks/use-intervals'
import { useNutritionData } from '@/components/nutrition/use-nutrition-data'
import { useBiometrics } from '@/components/nutrition/use-biometrics'
import { BiometricsCard } from '@/components/nutrition/biometrics-card'
import { totalEnergyBurnedKcal, recoveryGap, proteinTargetRange, computeBMR } from '@/components/nutrition/fueling-types'

export default function FuelingDetailPage() {
  const athlete = useAthlete()
  const todayId = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const activities = useActivities(todayId, todayId)
  const nutrition = useNutritionData()
  const biometrics = useBiometrics()

  const weightKg = athlete.data?.weight ?? null
  const isAvailable = weightKg != null && weightKg > 0
  const isLoading = athlete.isLoading || activities.isLoading || nutrition.isLoading || biometrics.isLoading

  const sportBurned = useMemo(() => totalEnergyBurnedKcal(activities.data, weightKg), [activities.data, weightKg])
  const bmr = useMemo(() => computeBMR(weightKg, biometrics.data), [weightKg, biometrics.data])
  const totalBurned = sportBurned + (bmr ?? 0)
  const eaten = nutrition.totals.calories
  const gap = recoveryGap(eaten, totalBurned)
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" /> Sport
                </div>
                <div className="text-2xl font-bold">{sportBurned}</div>
                <div className="text-[10px] text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <ActivityIcon className="w-3.5 h-3.5 text-purple-400" /> Métabolisme
                </div>
                <div className="text-2xl font-bold">{bmr ?? '—'}</div>
                <div className="text-[10px] text-muted-foreground">{bmr != null ? 'kcal' : 'à configurer'}</div>
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

        <BiometricsCard />

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Méthode de calcul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Sport</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Somme de l&apos;énergie dépensée sur les activités Intervals.icu du jour uniquement. Pour une
                sortie avec capteur de puissance : kJ de travail mécanique réel (puissance moyenne × durée),
                converti en kcal via la règle empirique kJ ≈ kcal (rendement brut d&apos;environ 23% et la
                conversion kJ→kcal se compensent presque exactement). Sans capteur de puissance : estimation
                durée × MET (selon l&apos;intensité Intervals.icu) × poids corporel.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Métabolisme (BMR)</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estimation du métabolisme de base — l&apos;énergie brûlée au repos complet sur 24h, indépendamment
                de toute activité — via la formule de Mifflin-St Jeor : <code>10 × poids(kg) + 6.25 × taille(cm)
                − 5 × âge + 5</code> pour un homme, <code>− 161</code> à la place de <code>+ 5</code> pour une
                femme. Nécessite taille/âge/sexe (saisis ci-dessus, Intervals.icu ne fournit que le poids) —
                affiche "à configurer" tant qu&apos;ils sont absents, jamais une estimation par défaut inventée.
                C&apos;est une estimation pour la journée entière, pas proratisée à l&apos;heure actuelle (contrairement
                à "Sport", qui ne reflète que les activités déjà enregistrées).
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
                Mangé − (Sport + Métabolisme) une fois le métabolisme configuré — un vrai bilan énergétique
                quotidien plutôt qu&apos;une comparaison au seul coût de la séance du jour. Tant que le métabolisme
                n&apos;est pas configuré, l&apos;écart se dégrade sur Mangé − Sport uniquement (jamais un métabolisme
                inventé) — dans ce cas, un écart positif ne reflète pas un vrai excédent de la journée, juste une
                marge par rapport à l&apos;entraînement.
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
                (aujourd&apos;hui "Sport") utilisait par erreur la puissance normalisée (icu_weighted_avg_watts, qui
                pondère les efforts intenses) plutôt que la puissance moyenne réelle pour ce calcul kJ≈kcal — la
                puissance normalisée est par construction toujours ≥ la puissance moyenne sur une sortie à
                intensité variable (fractionné, bosses), donc le nombre affiché était systématiquement gonflé sur
                ce type de sortie. Corrigé dans <code>bestAverageWatts()</code> (<code>intervals-api.ts</code>),
                qui alimente aussi le Budget kJ de la semaine — même correctif, même bénéfice là-bas.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
