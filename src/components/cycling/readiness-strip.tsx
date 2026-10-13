"use client"

// ── <ReadinessStrip> — refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md
// §3.3/§5, "Aujourd'hui") : "one card, 5 cells: verdict ... then Forme,
// Récupération, Sommeil, HRV·FC. Each cell has a confidence dot
// (good/warn/bad/unknown), a mono value and a 12px trend line. Replaces
// the 3 rings." Remplace le panneau RingItem×3/StatChip×2 de
// performance-bento.tsx — même donnée (tsb/readiness/sommeil/hrv/FC
// repos), juste reclassée en cellules compactes avec un vocabulaire de
// confiance unique (readiness-strip-types.ts) plutôt que 3 anneaux +
// 2 puces visuellement disjoints. RingGauge n'est pas retiré de l'app —
// toujours utilisé pour la progression du plan (plan-tab.tsx), un concept
// différent (% d'achèvement, pas un signal physiologique).

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  type Confidence,
  tsbConfidence,
  readinessConfidence,
  sleepConfidence,
  vitalsConfidence,
  buildReadinessVerdict,
  sparklinePoints,
} from './readiness-strip-types'
import { formatSleepDuration } from '@/components/lifestyle/lifestyle-types'

// Tokens posés à l'étape 1 (globals.css/tailwind.config.ts), jamais encore
// consommés avant ce composant — voir CLAUDE.md "Refonte UI/IA... étape 1".
const CONFIDENCE_DOT_CLASS: Record<Confidence, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  neutral: 'bg-muted-foreground',
  unknown: 'bg-unknown',
}

function ConfidenceDot({ confidence, title }: { confidence: Confidence; title: string }) {
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', CONFIDENCE_DOT_CLASS[confidence])} title={title} />
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 44
  const height = 12
  const points = sparklinePoints(values, width, height)
  if (!points) return <div className="h-3" aria-hidden />
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface CellProps {
  href: string
  label: string
  confidence: Confidence
  confidenceTitle: string
  value: ReactNode
  sparklineValues?: number[]
  sparklineColor?: string
}

function Cell({ href, label, confidence, confidenceTitle, value, sparklineValues, sparklineColor }: CellProps) {
  return (
    <Link href={href} className="flex-1 flex flex-col gap-1.5 px-3 py-2 group min-w-0">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <ConfidenceDot confidence={confidence} title={confidenceTitle} />
        {label}
      </span>
      <span className="font-data text-lg font-bold text-foreground">{value}</span>
      {sparklineValues && sparklineValues.length >= 2 ? (
        <Sparkline values={sparklineValues} color={sparklineColor ?? 'hsl(var(--muted-foreground))'} />
      ) : (
        <div className="h-3" aria-hidden />
      )}
    </Link>
  )
}

const CONFIDENCE_TITLE: Record<Confidence, string> = {
  good: 'Favorable',
  warn: 'Vigilance',
  bad: 'Signal défavorable',
  neutral: 'Donnée connue',
  unknown: 'Pas de donnée',
}

export interface ReadinessStripProps {
  tsb: number | null
  readiness: number | null
  sleepHours: number | null | undefined
  sleepQuality: number | null | undefined
  hrv: number | null | undefined
  restingHR: number | null | undefined
  /** Derniers points TSB (le plus ancien d'abord) — déjà chargés par la page pour la courbe PMC, voir cycling/page.tsx. */
  tsbSeries?: number[]
  /** `lifestyle.readinessSeries`/dailySeries — déjà calculés par useLifestyleData(), aucun nouveau fetch. */
  readinessSeries?: number[]
  sleepSeries?: number[]
  hrvSeries?: number[]
  restingHrSeries?: number[]
}

export function ReadinessStrip({
  tsb, readiness, sleepHours, sleepQuality, hrv, restingHR,
  tsbSeries, readinessSeries, sleepSeries, hrvSeries, restingHrSeries,
}: ReadinessStripProps) {
  const verdict = buildReadinessVerdict(tsb, readiness)
  const vitals = vitalsConfidence(hrv, restingHR)
  const vitalsValue = hrv != null || restingHR != null
    ? [hrv != null ? `${Math.round(hrv)} ms` : '—', restingHR != null ? `${Math.round(restingHR)} bpm` : '—'].join(' · ')
    : '—'

  return (
    <div className="lc-card p-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Verdict — pleine largeur sur mobile (spec §5.2), première cellule sur desktop */}
        <Link href="/cycling/metric/tsb" className="flex-1 flex items-center gap-3 px-4 py-3 group min-w-0 sm:max-w-[220px]">
          <ConfidenceDot confidence={verdict.confidence} title={CONFIDENCE_TITLE[verdict.confidence]} />
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate">{verdict.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{verdict.sentence}</p>
          </div>
        </Link>

        <div className="flex-1 grid grid-cols-2 sm:flex sm:flex-row divide-x divide-border [&>*:nth-child(2)]:border-t-0 sm:[&>*]:border-t-0">
          <Cell
            href="/cycling/metric/tsb"
            label="Forme"
            confidence={tsbConfidence(tsb)}
            confidenceTitle={CONFIDENCE_TITLE[tsbConfidence(tsb)]}
            value={tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
            sparklineValues={tsbSeries}
            sparklineColor="hsl(var(--form))"
          />
          <Cell
            href="/cycling/metric/readiness"
            label="Récupération"
            confidence={readinessConfidence(readiness)}
            confidenceTitle={CONFIDENCE_TITLE[readinessConfidence(readiness)]}
            value={readiness != null ? `${readiness}%` : '—'}
            sparklineValues={readinessSeries}
            sparklineColor="hsl(var(--primary))"
          />
          <Cell
            href="/cycling/metric/sleep"
            label="Sommeil"
            confidence={sleepConfidence(sleepQuality)}
            confidenceTitle={CONFIDENCE_TITLE[sleepConfidence(sleepQuality)]}
            value={sleepHours != null ? formatSleepDuration(sleepHours) : '—'}
            sparklineValues={sleepSeries}
            sparklineColor="hsl(var(--primary))"
          />
          <Cell
            href="/cycling/metric/hrv"
            label="HRV · FC"
            confidence={vitals}
            confidenceTitle={CONFIDENCE_TITLE[vitals]}
            value={vitalsValue}
            sparklineValues={restingHrSeries ?? hrvSeries}
            sparklineColor="hsl(var(--muted-foreground))"
          />
        </div>
      </div>
    </div>
  )
}
