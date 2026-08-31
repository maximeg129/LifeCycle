"use client"

// Détail du "Gouverneur de charge interne" — retour utilisateur : "crées de
// sous page qui donne du détails, méthode de calcul, compréhension,
// composition" pour ce widget (cerclé en vert avec le Budget kJ, sur une
// capture d'écran). Composite calculé en direct depuis 6 signaux (pas une
// métrique suivie jour par jour) — route dédiée plutôt que
// /cycling/metric/[id]. Le widget live est rendu ici tel quel (sans le lien
// vers cette page, pour ne pas boucler sur soi-même), suivi d'une
// explication fidèle à governor-types.ts/use-governor.ts — jamais une
// paraphrase approximative de ce que fait vraiment le calcul.

import Link from 'next/link'
import { ArrowLeft, HeartPulse, Activity, Gauge, MessageCircle, Smile, Moon, BarChart3 } from 'lucide-react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGovernor } from '@/components/cycling/use-governor'
import type { Signal } from '@/components/cycling/governor-types'
import type { GovernorStatus } from '@/components/cycling/load-types'

const STATUS_META: Record<GovernorStatus, { emoji: string; label: string; hint: string; className: string }> = {
  vert: { emoji: '🟢', label: 'Favorable', hint: 'Le budget kJ peut augmenter', className: 'text-green-400' },
  orange: { emoji: '🟠', label: 'Stable', hint: "Ne pas augmenter la charge cette semaine", className: 'text-orange-400' },
  rouge: { emoji: '🔴', label: 'Dégradé', hint: 'Stabiliser ou réduire la charge', className: 'text-red-400' },
  insufficient_data: { emoji: '⚪', label: 'Données insuffisantes', hint: 'Ajoutez des données de récupération ou du feedback de séance', className: 'text-muted-foreground' },
}

const SIGNAL_ROWS: { key: keyof ReturnType<typeof useGovernor>['signals']; label: string; icon: typeof HeartPulse; explanation: string }[] = [
  { key: 'restingHR', label: 'FC repos (tendance)', icon: HeartPulse, explanation: "FC repos du matin (auto-sync Intervals.icu). Moyenne des 7 derniers jours comparée à la moyenne des 21 jours précédents — plus bas est favorable (variation de plus de 3%)." },
  { key: 'hrvTrend', label: 'HRV (tendance)', icon: Activity, explanation: "HRV du matin (auto-sync Intervals.icu). Même comparaison 7j vs 21j précédents — plus haut est favorable." },
  { key: 'effortHrDrift', label: 'Dérive FC à l’effort', icon: Gauge, explanation: "Facteur d'efficacité (watts moyens ÷ FC moyenne) des sorties de basse intensité uniquement (< 75% d'intensité Intervals.icu) — à effort stable, plus de watts pour la même FC est favorable. Même comparaison 7j vs 21j précédents." },
  { key: 'rpe', label: 'RPE moyen (tendance)', icon: MessageCircle, explanation: "RPE saisi sur Intervals.icu en priorité pour chaque séance ; complété par le feedback local de l'app seulement pour les dates qu'Intervals.icu ne couvre pas. Plus bas est favorable. Même comparaison 7j vs 21j précédents." },
  { key: 'feelings', label: 'Sensations & motivation', icon: Smile, explanation: "Sensation ('feel') saisie sur Intervals.icu en priorité, sinon sensation + motivation du feedback local de l'app. Règle différente des 5 autres signaux : moyenne des 7 derniers jours seulement (pas de comparaison à une période précédente) — au-dessus de +0,25 c'est favorable, en dessous de -0,25 c'est défavorable." },
  { key: 'sleepRecovery', label: 'Sommeil & récup. (Vie & Santé)', icon: Moon, explanation: "Score de readiness calculé depuis la même série fusionnée (auto-sync Intervals.icu + saisie manuelle) que la page Vie & Santé. Plus haut est favorable. Même comparaison 7j vs 21j précédents." },
]

function signalDot(signal: Signal): string {
  if (signal === 1) return 'bg-green-400'
  if (signal === -1) return 'bg-red-400'
  if (signal === 0) return 'bg-orange-400'
  return 'bg-muted-foreground/30'
}

function signalLabel(signal: Signal): string {
  if (signal === 1) return 'Favorable'
  if (signal === -1) return 'Défavorable'
  if (signal === 0) return 'Neutre'
  return 'N/D'
}

export default function GovernorDetailPage() {
  const governor = useGovernor()
  const meta = STATUS_META[governor.status]

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
          title="Gouverneur de charge interne"
          description="FC repos, HRV, dérive à l'effort, RPE, sensations — pas un plan rigide"
        />

        {governor.isLoading ? (
          <Card className="bg-card/40 border-border">
            <CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent>
          </Card>
        ) : (
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase">Gouverneur de charge interne</CardTitle>
              <CardDescription className="text-xs">FC repos, HRV, dérive à l&apos;effort, RPE, sensations — pas un plan rigide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <div className={`font-semibold ${meta.className}`}>{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.hint}</div>
                </div>
              </div>
              <div className="space-y-2">
                {SIGNAL_ROWS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${signalDot(governor.signals[key])}`} />
                      {signalLabel(governor.signals[key])}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!governor.isLoading && governor.trainingLoad && (
          <Card className="bg-card/40 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" /> Charge d&apos;entraînement (session-RPE)
              </CardTitle>
              <CardDescription className="text-xs">7 derniers jours — Foster (1998/2001, R21), distinct des 6 signaux ci-dessus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-bold lc-data">{governor.trainingLoad.weeklySessionRPE}</div>
                  <div className="text-xs text-muted-foreground">Charge hebdo (session-RPE)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold lc-data">{governor.trainingLoad.monotony != null ? governor.trainingLoad.monotony.toFixed(2) : '—'}</div>
                  <div className="text-xs text-muted-foreground">Monotonie</div>
                </div>
                <div>
                  <div className="text-2xl font-bold lc-data">{governor.trainingLoad.strain ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">Strain</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-3">
                Chiffres descriptifs uniquement — aucun seuil sourcé ne permet de classer une monotonie ou un strain donné
                comme &laquo;&nbsp;élevé&nbsp;&raquo; (voir docs/OPEN_QUESTIONS.md, Q7), donc ni l&apos;un ni l&apos;autre
                n&apos;entre dans le statut du gouverneur ci-dessus. Basé uniquement sur les activités Intervals.icu portant
                à la fois un RPE et une durée — un feedback local sans activité liée n&apos;a pas de durée associée et
                n&apos;est donc pas compté ici.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base">Méthode de calcul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              6 signaux indépendants, chacun classé Favorable (+1), Neutre (0), Défavorable (-1) ou N/D (pas assez
              de données). Le statut global additionne les signaux non-nuls : somme positive → <span className="font-medium text-foreground">🟢 Favorable</span>,
              somme négative → <span className="font-medium text-foreground">🔴 Dégradé</span>, somme nulle → <span className="font-medium text-foreground">🟠 Stable</span>.
              Avec moins de 2 signaux exploitables, le statut est honnêtement <span className="font-medium text-foreground">⚪ Données insuffisantes</span> plutôt qu&apos;une supposition.
              Ce statut pilote ensuite directement l&apos;objectif du <Link href="/cycling/budget" className="text-primary hover:underline">budget kJ de la semaine</Link>.
            </p>
            <div className="space-y-3">
              {SIGNAL_ROWS.map(({ key, label, icon: Icon, explanation }) => (
                <div key={key}>
                  <div className="text-sm font-medium mb-1 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground" /> {label}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
                </div>
              ))}
              <div>
                <div className="text-sm font-medium mb-1 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-muted-foreground" /> Charge d&apos;entraînement (session-RPE)</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Distinct des 6 signaux ci-dessus, pas un 7e signal du vote. Session-RPE d&apos;une séance = RPE (0-10)
                  × durée en minutes (Foster 2001, R21). Monotonie = moyenne ÷ écart-type de la charge quotidienne sur
                  les 7 derniers jours ; strain = charge hebdomadaire totale × monotonie (Foster 1998, compagnon cité
                  dans R21). Aucun seuil chiffré sourcé ne permet de qualifier une monotonie/un strain donné
                  d&apos;&laquo;&nbsp;élevé&nbsp;&raquo; — ces deux chiffres restent donc purement descriptifs, jamais
                  intégrés au statut global.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
