// ── TSB "freshness" zone classification ─────────────────────────────────
//
// Same 5-zone scheme Intervals.icu itself shows on its own Form chart
// (Transition / Fresh / Grey Zone / Optimal / High Risk, with the exact
// -30 / -10 / 5 / 20 boundaries) — user feedback, from a screenshot of
// their own Intervals.icu Form chart: "peux t on rajouter l'état de
// fraîcheur dans une tuile... conserve la couleur comme indicateur".
// Reusing these exact boundaries means the tile's color-coding means the
// same thing an athlete already reads off Intervals.icu directly, rather
// than a second, bespoke scale to learn. Replaces the old 4-band
// tsbLabel() that lived in performance-bento.tsx.

export type TsbZoneId = 'transition' | 'fresh' | 'grey' | 'optimal' | 'high-risk'

export interface TsbZone {
  id: TsbZoneId
  label: string
  /** One-line explanation of what training at this level of freshness means. */
  description: string
  /** Lower (exclusive) bound of the zone, or null for "no floor" (High Risk). */
  min: number | null
  /** Upper (inclusive) bound of the zone, or null for "no ceiling" (Transition). */
  max: number | null
  textClassName: string
  /** Soft tint, for card/badge backgrounds (plain HTML — a Tailwind `bg-*` class has no effect on an SVG shape's `fill`). */
  bgClassName: string
  /** Solid color, for a small status dot. */
  dotClassName: string
  /**
   * Real CSS color, for the chart's `<ReferenceArea>` bands — recharts
   * shapes are SVG, which paints via the `fill` attribute, not the CSS
   * `background-color` property `bg-*` utilities set, so `bgClassName`
   * would silently render nothing there. `hsl(var(--muted))`/
   * `hsl(var(--destructive))` reuse the app's own design tokens (same
   * pattern as this chart's `stroke="hsl(var(--border))"`); the others
   * aren't tokens in this app, so they're the literal Tailwind default hex
   * for that shade.
   */
  fillColor: string
}

const ZONES: Record<TsbZoneId, TsbZone> = {
  transition: {
    id: 'transition',
    label: 'Transition',
    description: 'Très frais, au point de perdre en fitness si ça dure — bon moment pour une compétition, pas pour y rester.',
    min: 20,
    max: null,
    textClassName: 'text-orange-600',
    bgClassName: 'bg-orange-500/10',
    dotClassName: 'bg-orange-500',
    fillColor: '#f97316',
  },
  fresh: {
    id: 'fresh',
    label: 'Frais',
    description: 'Fatigue basse, de la marge pour pousser une séance clé.',
    min: 5,
    max: 20,
    textClassName: 'text-blue-600',
    bgClassName: 'bg-blue-500/10',
    dotClassName: 'bg-blue-500',
    fillColor: '#3b82f6',
  },
  grey: {
    id: 'grey',
    label: 'Zone grise',
    description: "Ni frais ni chargé — l'entraînement normal se passe ici la plupart du temps.",
    min: -10,
    max: 5,
    textClassName: 'text-muted-foreground',
    bgClassName: 'bg-muted',
    dotClassName: 'bg-muted-foreground',
    fillColor: 'hsl(var(--muted-foreground))',
  },
  optimal: {
    id: 'optimal',
    label: 'Charge productive',
    description:
      "Zone de charge productive typique pour beaucoup d'athlètes entraînés — pas un état de forme optimal universel : les modèles CTL/ATL/TSB n'ont pas de signification comparable d'un athlète ou d'un modèle à l'autre (R03), votre propre zone productive se lit dans votre trajectoire personnelle, pas dans ce chiffre isolé.",
    min: -30,
    max: -10,
    textClassName: 'text-green-600',
    bgClassName: 'bg-green-500/10',
    dotClassName: 'bg-green-500',
    fillColor: '#22c55e',
  },
  'high-risk': {
    id: 'high-risk',
    label: 'Risque élevé',
    description: 'Fatigue très élevée — priorité à la récupération avant de recharger.',
    min: null,
    max: -30,
    textClassName: 'text-destructive',
    bgClassName: 'bg-destructive/10',
    dotClassName: 'bg-destructive',
    fillColor: 'hsl(var(--destructive))',
  },
}

/** From highest TSB to lowest — the order the bands stack top-to-bottom on a chart, and the order Intervals.icu's own legend lists them. */
export const TSB_ZONES_ORDERED: TsbZone[] = [ZONES.transition, ZONES.fresh, ZONES.grey, ZONES.optimal, ZONES['high-risk']]

/** Classifies a TSB value into its freshness zone. Boundaries mirror Intervals.icu's own Form chart bands (20 / 5 / -10 / -30). */
export function tsbZone(tsb: number): TsbZone {
  if (tsb > 20) return ZONES.transition
  if (tsb > 5) return ZONES.fresh
  if (tsb > -10) return ZONES.grey
  if (tsb > -30) return ZONES.optimal
  return ZONES['high-risk']
}
