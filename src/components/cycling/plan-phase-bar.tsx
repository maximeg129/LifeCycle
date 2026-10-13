"use client"

// ── <PlanPhaseBar> — barre de phases du plan entier ──────────────────────
//
// Restructuration lifecycle-ui-reference.html (voir CLAUDE.md, "Refonte
// UI/IA... Work Package D") : la carte "Phases" montre une seule barre
// horizontale, un segment coloré par run de semaines consécutives de même
// phase (flex proportionnel au nombre de semaines), avec un repère triangle
// sous le segment qui contient la semaine en cours — remplace le simple
// badge de phase qui n'existait qu'au survol/à l'intérieur de chaque ligne
// de semaine (WeekRow, plan-overview-grid.tsx, inchangé). Couleurs réelles
// (z1-z5, mêmes tokens zones Coggan posés à l'étape 1 — jamais une classe
// bg-* : plusieurs segments adjacents de couleurs différentes dans un même
// flex container n'ont pas besoin d'opacité, juste des couleurs pleines
// lisibles en texte blanc, sauf le jaune (z4/build) qui a besoin d'un texte
// sombre pour rester lisible — même piège déjà documenté pour tsb-zones.ts/
// ring-metrics.ts).

import { cn } from '@/lib/utils'
import { buildPhaseSegments, phaseSegmentLabel, type PlanPhase, type PlanWeek } from './training-plan-types'

const SEGMENT_COLOR: Record<PlanPhase, string> = {
  base: 'hsl(var(--z2))',
  recovery: 'hsl(var(--z1))',
  build: 'hsl(var(--z4))',
  peak: 'hsl(var(--z5))',
  taper: 'hsl(var(--z3))',
}

// Seul z4 (jaune) a besoin d'un texte sombre pour rester lisible — les
// autres segments restent en blanc, comme la référence.
const DARK_TEXT_PHASES: ReadonlySet<PlanPhase> = new Set(['build'])

interface Props {
  weeks: PlanWeek[]
  currentWeekNumber: number | null
}

export function PlanPhaseBar({ weeks, currentWeekNumber }: Props) {
  const segments = buildPhaseSegments(weeks, currentWeekNumber)
  if (segments.length === 0) return null

  return (
    <div className="flex gap-[3px] pb-2">
      {segments.map((segment, i) => (
        <div
          key={`${segment.startWeekNumber}-${i}`}
          className="relative h-7 rounded-md flex items-center justify-center text-xs font-semibold"
          style={{
            flex: segment.weekCount,
            backgroundColor: segment.isTest ? 'hsl(var(--foreground))' : SEGMENT_COLOR[segment.phase],
            color: segment.isTest ? 'hsl(var(--background))' : DARK_TEXT_PHASES.has(segment.phase) ? 'hsl(var(--foreground))' : '#fff',
          }}
          title={`S${segment.startWeekNumber}${segment.endWeekNumber !== segment.startWeekNumber ? `–S${segment.endWeekNumber}` : ''}`}
        >
          {phaseSegmentLabel(segment)}
          {segment.isCurrent && (
            <span
              className={cn(
                'absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0',
                'border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-foreground'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
