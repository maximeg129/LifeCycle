"use client"

// ── Graphique Puissance & FC (Activité détail) ───────────────────────────
//
// Restructuration lifecycle-ui-reference.html, écran "Activité (detail)" :
// une ligne puissance (brand) + une ligne FC (fatigue), avec des bandes
// ombrées (z5, opacité légère) marquant les fenêtres temporelles des
// intervalles prévus. Toute la logique (downsampling, échelle, segments de
// ligne, fenêtres cibles) vit dans ride-chart-types.ts, pure et testée
// séparément — ce composant ne fait que positionner des <polyline>/<rect>
// SVG à partir de ces résultats déjà calculés.
//
// SVG plutôt que Recharts (comme WorkoutProfileChart/RingGauge) : un
// widget compact à deux séries + bandes ombrées, plus simple à contrôler
// pixel par pixel qu'à travers l'API d'un wrapper de charting généraliste.

import { useMemo } from 'react'
import { buildChartLineSegments, chartSeriesRange, type RideChartSeries, type IntervalTargetWindow } from './ride-chart-types'

const WIDTH = 600
const HEIGHT = 140
const PADDING_Y = 10

interface Props {
  series: RideChartSeries
  /** Fenêtres temporelles des étapes prévues — absent si aucune séance prévue n'a pu être comparée (voir computeIntervalAdherence). */
  targetWindows?: IntervalTargetWindow[]
}

export function RidePowerHrChart({ series, targetWindows }: Props) {
  const powerRange = useMemo(() => chartSeriesRange(series.points, (p) => p.watts), [series])
  const hrRange = useMemo(() => chartSeriesRange(series.points, (p) => p.hr), [series])

  const powerSegments = useMemo(
    () => (powerRange ? buildChartLineSegments(series.points, (p) => p.watts, series.totalSeconds, powerRange.min, powerRange.max, WIDTH, HEIGHT, PADDING_Y) : []),
    [series, powerRange]
  )
  const hrSegments = useMemo(
    () => (hrRange ? buildChartLineSegments(series.points, (p) => p.hr, series.totalSeconds, hrRange.min, hrRange.max, WIDTH, HEIGHT, PADDING_Y) : []),
    [series, hrRange]
  )

  if (powerSegments.length === 0 && hrSegments.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-subtle">
        {powerSegments.length > 0 && (
          <span className="flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(var(--primary))' }} />
            Puissance
          </span>
        )}
        {hrSegments.length > 0 && (
          <span className="flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(var(--fatigue))' }} />
            FC
          </span>
        )}
        {targetWindows && targetWindows.length > 0 && (
          <span className="flex items-center gap-1.5">
            <i className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(var(--z5))', opacity: 0.4 }} />
            Cible
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }} preserveAspectRatio="none">
        {series.totalSeconds > 0 && targetWindows?.map((w, i) => {
          const x = (w.startSeconds / series.totalSeconds) * WIDTH
          const rectWidth = ((w.endSeconds - w.startSeconds) / series.totalSeconds) * WIDTH
          if (rectWidth <= 0) return null
          return <rect key={i} x={x} y={0} width={rectWidth} height={HEIGHT} fill="hsl(var(--z5))" opacity={0.14} />
        })}
        {powerSegments.map((segment, i) => (
          <polyline
            key={`power-${i}`}
            points={segment.map((pt) => `${pt.x},${pt.y}`).join(' ')}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {hrSegments.map((segment, i) => (
          <polyline
            key={`hr-${i}`}
            points={segment.map((pt) => `${pt.x},${pt.y}`).join(' ')}
            fill="none"
            stroke="hsl(var(--fatigue))"
            strokeWidth={1.5}
            strokeOpacity={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  )
}
