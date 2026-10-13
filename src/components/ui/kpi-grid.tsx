// ── <KpiGrid> — refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md §4,
// "<KpiGrid>: 1px gap grid on the border colour (hairline dividers) with
// mono values. Used for activity KPIs and session targets.") — un
// composant générique, premier usage dans RideAnalysisDialog (voir
// CLAUDE.md "Refonte UI/IA... étape 5"). `value` honnête : "—" plutôt
// qu'omettre la cellule quand une donnée manque, pour garder une grille
// régulière sans jamais inventer un chiffre.

import type { ReactNode } from 'react'

export interface KpiGridItem {
  label: string
  value: ReactNode
  unit?: string
}

export function KpiGrid({ items }: { items: KpiGridItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
      {items.map((item, i) => (
        <div key={i} className="bg-card p-3 flex flex-col gap-0.5 min-w-0">
          <span className="text-xs uppercase tracking-wider text-muted-foreground truncate">{item.label}</span>
          <span className="font-data text-sm font-bold truncate">
            {item.value}
            {item.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{item.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
