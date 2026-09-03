"use client"

// Preuve visible que la synchro automatique (use-intervals.tsx) a bien
// tourné — retour utilisateur, sur Garage : "je pense vraiment que c'est
// simplement lié au chaînes qui attendent le déclenchement du sync en
// appuyant sur un bouton que nous avons précédemment enlevé." Le bouton a
// bien été retiré de cette page (task "Un seul bouton Synchroniser, dans
// Réglages") — délibérément, pour n'avoir qu'un seul déclencheur manuel
// dans toute l'app — mais la synchro automatique à l'ouverture (isSyncing/
// lastSyncedAt, déjà suivis par IntervalsProvider) n'était affichée nulle
// part : rien ne prouvait à l'utilisateur qu'elle avait réellement tourné,
// d'où l'impression qu'elle dépendait encore du bouton disparu. Cette
// ligne n'ajoute PAS de bouton (le seul de l'app reste dans Réglages,
// décision volontaire inchangée) — juste le statut réel, en lecture seule.
import { RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useIntervalsSync } from '@/hooks/use-intervals'

export function SyncStatusLine() {
  const { isSyncing, lastSyncedAt, isConfigured } = useIntervalsSync()

  if (!isConfigured) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw className={isSyncing ? 'w-3 h-3 animate-spin' : 'w-3 h-3'} />
      {isSyncing
        ? 'Synchronisation Intervals.icu en cours…'
        : lastSyncedAt
          ? `Synchronisé ${formatDistanceToNow(lastSyncedAt, { addSuffix: true, locale: fr })} (automatique)`
          : 'Synchronisation automatique pas encore effectuée sur cette session'}
    </div>
  )
}
