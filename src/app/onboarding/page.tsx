"use client"

// Guide de démarrage Intervals.icu — retour utilisateur (audit onboarding) :
// avant ce fichier, `/settings` était le seul écran mentionnant
// Intervals.icu, et il supposait déjà un compte existant (deux champs vides
// + un lien vers intervals.icu/settings). Un nouvel utilisateur sans compte
// n'avait aucun chemin documenté in-app — juste "Configurez... dans les
// réglages". Cette page est CE chemin, en 4 étapes explicites : créer le
// compte, connecter une source d'activité (Garmin/Strava/Wahoo — ce n'est
// PAS LifeCycle qui s'en charge, ça se fait entièrement côté Intervals.icu),
// générer la clé API, la renseigner ici. Pas dans navItems (comme
// /lifestyle, /finance) — accessible depuis NotConfiguredBanner, /settings,
// et les bandeaux non-bloquants de Coach>Aujourd'hui/Plan.

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ExternalLink, Settings2, UserPlus, Link2, KeyRound, Clock, BadgeInfo } from 'lucide-react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAthlete } from '@/hooks/use-intervals'
import { cn } from '@/lib/utils'

interface Step {
  icon: typeof UserPlus
  title: string
  description: string
  cta?: { label: string; href: string; external?: boolean }
  done?: boolean
}

export default function OnboardingPage() {
  const athlete = useAthlete()
  // Même vérification que le reste de l'app (use-intervals.tsx) — les deux
  // champs non-vides, pas une validation de leur exactitude (une clé
  // invalide reste "connectée" ici mais échouera au premier sync, avec
  // l'erreur remontée sur Cyclisme).
  const isConnected = athlete.isConfigured

  const steps: Step[] = [
    {
      icon: UserPlus,
      title: '1. Créer un compte Intervals.icu (gratuit)',
      description:
        "Intervals.icu est un service tiers indépendant, gratuit, qui centralise vos données d'entraînement (CTL/ATL/TSB, puissance, sommeil, HRV...). LifeCycle ne stocke jamais ces données brutes lui-même — il les lit depuis Intervals.icu via son API, avec vos identifiants à vous. Si vous avez déjà un compte, passez à l'étape suivante.",
      cta: { label: 'Créer un compte sur intervals.icu', href: 'https://intervals.icu', external: true },
    },
    {
      icon: Link2,
      title: '2. Connecter votre source d’activité',
      description:
        "Ça se passe entièrement sur Intervals.icu, pas dans LifeCycle : une fois connecté, allez dans Settings → Connections et liez Garmin Connect, Strava, Wahoo, ou tout autre appareil/service que vous utilisez déjà pour enregistrer vos sorties. C'est cette connexion qui alimente ensuite tout le reste — sans elle, Intervals.icu n'a aucune activité à vous montrer, donc LifeCycle non plus.",
      cta: { label: 'Aller sur Intervals.icu', href: 'https://intervals.icu/settings', external: true },
    },
    {
      icon: KeyRound,
      title: '3. Générer votre clé API',
      description:
        'Toujours sur Intervals.icu : ouvrez vos paramètres (Settings), descendez tout en bas de la page jusqu’à la section "Developer Settings", et cliquez sur le bouton pour générer une clé API. Notez-la quelque part le temps de l’étape suivante — Intervals.icu ne la réaffiche pas ensuite en clair.',
      cta: { label: 'Aller sur Intervals.icu', href: 'https://intervals.icu/settings', external: true },
    },
    {
      icon: Settings2,
      title: '4. Renseigner vos identifiants dans LifeCycle',
      description:
        "Dans Réglages, section «Intégration Intervals.icu» : collez votre ID Athlète (visible en haut de vos paramètres Intervals.icu, sous la forme i123456) et la clé API générée à l'étape précédente, puis Enregistrer.",
      cta: { label: 'Aller dans Réglages', href: '/settings' },
      done: isConnected,
    },
  ]

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <Link href="/cycling" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à Cyclisme
        </Link>

        <PageHeader
          category="Démarrage"
          title="Connecter Intervals.icu"
          description="LifeCycle ne mesure rien lui-même — vos données de performance viennent d'Intervals.icu, qui les récupère depuis votre montre/appli. Quatre étapes, à faire une seule fois."
          badge={
            isConnected ? (
              <Badge className="rounded-full bg-green-500/10 text-green-600 border-none text-xs px-3 w-fit">
                <CheckCircle2 className="w-3 h-3 mr-1.5" /> Connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-xs px-3 w-fit text-muted-foreground">
                Non connecté
              </Badge>
            )
          }
        />

        <div className="space-y-4">
          {steps.map((step) => (
            <Card key={step.title} className={cn('lc-card', step.done && 'border-green-500/30 bg-green-500/5')}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0',
                    step.done ? 'bg-green-500/10' : 'bg-primary/10'
                  )}>
                    {step.done ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <step.icon className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold">{step.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-1.5">{step.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {step.cta && (
                <CardContent className="pt-0 pl-[3.75rem]">
                  {step.cta.external ? (
                    <a
                      href={step.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      {step.cta.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <Link href={step.cta.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      {step.cta.label}
                    </Link>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Délai de sync — retour utilisateur (plan validé) : "ce qu'il faut
            faire pour que les données commencent à apparaître (délai de
            sync, premier import, etc.)". La synchro elle-même est
            automatique (use-intervals.tsx, une fois par session) — ce
            qu'un nouvel utilisateur ne sait pas c'est le délai côté
            Intervals.icu lui-même avant qu'une activité fraîchement
            connectée y apparaisse. */}
        <Card className="lc-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-[10px] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Combien de temps avant de voir mes données ?</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pl-[3.75rem] space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              Une fois les 4 étapes ci-dessus faites, LifeCycle synchronise automatiquement à chaque ouverture de
              l&apos;app (bouton &laquo;&nbsp;Synchroniser&nbsp;&raquo; dans Réglages pour forcer un rafraîchissement
              immédiat). Le délai qui compte est celui d&apos;<em>Intervals.icu</em> lui-même : une activité Strava
              apparaît généralement en quelques minutes, Garmin peut prendre plus longtemps (jusqu&apos;à quelques
              heures selon leur propre synchro). CTL/ATL/TSB ont besoin d&apos;un peu d&apos;historique (plusieurs
              jours d&apos;activités) pour devenir significatifs — une seule sortie fraîchement importée ne suffit
              pas à peupler tout de suite les tuiles Vue d&apos;ensemble.
            </p>
          </CardContent>
        </Card>

        {/* Attribution Garmin — retour utilisateur : "Intervals.icu impose
            une attribution des données Garmin quand elles transitent par
            Intervals.icu (section 1.1 de leurs terms)". Formule générique
            (validée par l'utilisateur, AskUserQuestion — texte exact des
            ToS non vérifiable depuis ce sandbox, réseau bloqué vers
            intervals.icu comme documenté ailleurs dans CLAUDE.md). Placée
            ici plutôt que dans une page "À propos" séparée : c'est déjà
            l'endroit où l'app explique que Garmin/Strava/Wahoo se
            connectent côté Intervals.icu (étape 2 ci-dessus) — cette carte
            prolonge naturellement cette explication. */}
        <Card className="lc-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-[10px] flex items-center justify-center shrink-0">
                <BadgeInfo className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">À propos des données</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pl-[3.75rem] space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              Les données d&apos;activité affichées dans LifeCycle — y compris celles d&apos;origine Garmin
              (Garmin-sourced data) — proviennent de votre compte Intervals.icu, qui les récupère lui-même
              depuis la source que vous avez connectée (Garmin Connect, Strava, Wahoo, ou autre).
              LifeCycle ne se connecte jamais directement à Garmin ni aux autres fabricants : Intervals.icu
              reste le seul intermédiaire, conformément à ses propres conditions d&apos;utilisation.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
    </AuthGuard>
  )
}
