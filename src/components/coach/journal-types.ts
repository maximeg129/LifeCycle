// ── Groupement par semaine pour le Journal d'activités ──────────────────
//
// Refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md §3.4, "Activités (list,
// not mocked)... Week-grouped list") — extrait de rides-journal-tab.tsx
// (un fichier "use client") pour rester une logique pure testable, même
// patron que les autres fichiers `*-types.ts` de ce projet. Générique sur
// `{date: string}` plutôt que sur le vrai type JournalEntry (qui vit dans
// le composant) — aucune raison de connaître le détail d'une entrée
// vélo/musculation pour regrouper par semaine.

import { format, parseISO, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Clé de semaine calendaire (lundi-dimanche, même convention que buildPlanWeekSkeleton) — 'unknown' si la date est absente/invalide, jamais une exception propagée. */
export function weekGroupKey(dateStr: string): string {
  if (!dateStr) return 'unknown'
  try {
    return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  } catch {
    return 'unknown'
  }
}

export interface WeekGroup<T> {
  key: string
  entries: T[]
}

/**
 * `entries` doit déjà être trié (le plus récent d'abord) — regroupe les
 * entrées consécutives de la même semaine calendaire en un seul groupe.
 * Ne re-trie jamais — un groupement sur une liste non triée produirait
 * plusieurs groupes pour la même semaine plutôt qu'un seul.
 */
export function groupByWeek<T extends { date: string }>(entries: T[]): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = []
  for (const entry of entries) {
    const key = weekGroupKey(entry.date)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.entries.push(entry)
    else groups.push({ key, entries: [entry] })
  }
  return groups
}

export function weekGroupLabel(key: string): string {
  if (key === 'unknown') return 'Date inconnue'
  try {
    return `Semaine du ${format(parseISO(key), 'd MMMM', { locale: fr })}`
  } catch {
    return 'Date inconnue'
  }
}
