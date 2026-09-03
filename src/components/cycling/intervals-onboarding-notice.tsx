"use client"

// Bandeau informatif non-bloquant — retour utilisateur (audit onboarding) :
// Coach > Aujourd'hui et Coach > Plan laissaient l'athlète découvrir qu'il
// n'était pas connecté à Intervals.icu seulement APRÈS avoir généré une
// proposition IA, via une petite ligne grise sous le bouton d'envoi
// ("Connectez Intervals.icu dans Réglages pour envoyer la séance."). Ce
// bandeau porte la même information plus tôt, en haut de l'onglet — même
// patron visuel que le bandeau non-bloquant déjà en place sur
// `/lifestyle` (`wellnessStatus.isConfigured`), qui laisse la page
// fonctionner en mode dégradé plutôt que de la bloquer : ici aussi, la
// génération IA fonctionne déjà sans connexion (contexte d'entraînement
// simplement omis), seul l'envoi vers le calendrier Intervals.icu est
// indisponible.
//
// Pointe vers /onboarding (le guide pas-à-pas) plutôt que directement
// /settings — un athlète qui voit ce bandeau n'a pas forcément encore de
// compte Intervals.icu du tout.

import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export function IntervalsOnboardingNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-secondary/30 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <WifiOff className="w-4 h-4 shrink-0" />
        {message}
      </span>
      <Link href="/onboarding" className="shrink-0 font-medium text-primary hover:underline">
        Guide de démarrage
      </Link>
    </div>
  )
}
