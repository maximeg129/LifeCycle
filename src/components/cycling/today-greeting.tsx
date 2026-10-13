"use client"

// ── Salutation "Bonjour {prénom}" en tête d'Aujourd'hui ──────────────────
//
// Retour utilisateur, capture d'écran jointe ("make the Aujourd'hui page as
// the attached") : la référence ouvre l'écran sur une eyebrow date
// ("LUNDI 12 OCTOBRE") + "Bonjour {Prénom}" — absent de l'app jusqu'ici.
// Volontairement INDÉPENDANT des données du plan (jamais une deuxième
// instance de useTrainingPlan() — ce composant ne lit que useUser(), un
// contexte déjà partagé/léger, pour ne pas dupliquer tous les hooks lourds
// que useTrainingPlan() agrège (budget/gouverneur/mémoire coach...) juste
// pour afficher un prénom). La ligne "Semaine N/T · Phase · Jj avant
// l'objectif · Voir le plan ›" reste là où elle vit déjà (training-plan-
// tab.tsx, sa propre instance du hook) plutôt que fusionnée sur la même
// ligne que ce composant — même contenu/fonction, juste pas la même rangée
// visuelle que la référence : un risque de duplication de lecture Firestore
// jugé pire qu'un alignement pixel-parfait.

import { useUser } from '@/firebase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Premier prénom depuis le displayName Firebase, replié sur la partie locale de l'email — jamais un prénom deviné au-delà de ce que l'athlète a lui-même renseigné. */
function firstNameFrom(user: { displayName?: string | null; email?: string | null } | null | undefined): string | null {
  if (user?.displayName) {
    const first = user.displayName.trim().split(/\s+/)[0]
    if (first) return first
  }
  if (user?.email) {
    const local = user.email.split('@')[0]
    if (local) return local
  }
  return null
}

export function TodayGreeting() {
  const { user } = useUser()
  const firstName = firstNameFrom(user)

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
        {format(new Date(), 'EEEE d MMMM', { locale: fr })}
      </p>
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight mt-0.5">
        Bonjour{firstName ? ` ${firstName}` : ''}
      </h1>
    </div>
  )
}
