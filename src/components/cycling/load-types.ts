// ── Governor status + date helper — pure functions, no Firebase deps ──────
//
// Historiquement ce fichier portait aussi tout le modèle de budget kJ brut
// (sessionKJ/bucketWeeklyKJ/baselineKJ/currentWeekKJ/computeKJTrend/
// computeTargetKJ) — retiré (PR 11c) une fois `domain/cycling/metrics/kj.ts`
// (kJ/kg pondéré, livré en PR 4) effectivement branché dans l'app à la
// place : docs/AUDIT_CYCLING.md §3.2 documentait ce budget en kJ bruts
// comme une contradiction directe avec la spécification ("Unité : kJ/kg,
// jamais kJ bruts"). Ne restent ici que `GovernorStatus` (le type partagé
// par le gouverneur de charge interne, sans lien avec le budget kJ) et
// `mondayOf` (utilisé par training-plan-types.ts) — voir kj.ts pour son
// propre `mondayOf` dupliqué délibérément (le domaine ne dépend d'aucun
// fichier sous src/components).

export type GovernorStatus = 'vert' | 'orange' | 'rouge' | 'insufficient_data'

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday (yyyy-MM-dd, local time) of the week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const dow = d.getDay()
  const diff = (dow + 6) % 7 // days since Monday
  d.setDate(d.getDate() - diff)
  return isoDate(d)
}
