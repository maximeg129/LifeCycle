"use client"

// Shared between the Entraînement and PMC tabs — both need the same
// "connect Intervals.icu first" banner, and PMC is now a separately
// code-split chunk (see pmc-tab.tsx), so this couldn't stay a private
// helper inside cycling/page.tsx without duplicating it.
//
// CTA principal vers /onboarding plutôt que /settings — retour utilisateur
// (audit onboarding) : /settings suppose déjà un compte Intervals.icu
// existant (deux champs vides, un lien vers intervals.icu/settings), ce qui
// laissait un athlète sans compte sans aucun chemin. /onboarding est le
// guide pas-à-pas (créer le compte, connecter Garmin/Strava/Wahoo, générer
// la clé API, la renseigner) ; un lien secondaire vers /settings reste pour
// qui a déjà ses identifiants sous la main.

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Rocket } from 'lucide-react'
import Link from 'next/link'

export function NotConfiguredBanner() {
  return (
    <Card className="bg-card/40 border-border border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <AlertTriangle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Intervals.icu non connecté</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          LifeCycle affiche vos données de performance à partir d&apos;Intervals.icu — connectez-le pour synchroniser
          CTL/ATL/TSB, FTP, sommeil, HRV et vos sorties.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/onboarding">
            <Button className="gap-2">
              <Rocket className="w-4 h-4" /> Voir le guide de démarrage
            </Button>
          </Link>
          <Link href="/settings" className="text-xs text-muted-foreground hover:text-primary hover:underline">
            Vous avez déjà vos identifiants ? Aller dans Réglages
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
