// ── Formatage partagé durée/distance d'une activité Intervals.icu ──────
//
// Extrait de rides-journal-tab.tsx pour que RideAnalysisDialog (son
// KpiGrid, voir CLAUDE.md "Refonte UI/IA... étape 5") puisse réutiliser le
// MÊME formatage plutôt qu'une deuxième convention — vivent dans leur
// propre fichier plutôt que d'être exportés depuis rides-journal-tab.tsx
// pour éviter un cycle d'import (ce fichier-ci importe déjà
// RideAnalysisDialog depuis ride-analysis-dialog.tsx).

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || isNaN(meters)) return '—'
  const km = meters / 1000
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}
