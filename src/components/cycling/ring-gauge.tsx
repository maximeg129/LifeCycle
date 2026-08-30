"use client"

// A Whoop-style circular progress ring — user feedback, a screenshot of
// Whoop's own Sommeil/Récupération/Effort rings: "peux ton avoir...
// représenté de cette façon ?". Plain SVG (stroke-dasharray trick), no
// charting library needed for something this simple.

import type { ReactNode } from 'react'

interface RingGaugeProps {
  /** 0-100 — clamped internally, so an out-of-range value never breaks the arc math. */
  percent: number
  /** Real CSS color for the progress arc — see ring-metrics.ts for why this is a color string, not a Tailwind class. */
  color: string
  trackColor?: string
  size?: number
  strokeWidth?: number
  children?: ReactNode
}

export function RingGauge({ percent, color, trackColor = 'rgba(255,255,255,0.14)', size = 92, strokeWidth = 8, children }: RingGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
