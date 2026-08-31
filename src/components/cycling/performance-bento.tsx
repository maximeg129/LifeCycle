"use client"

// ── "Vue d'ensemble" — dense metric-tile grid for Cyclisme ─────────────
//
// Every metric the coach IA actually uses, at a glance — inspired by
// Whoop's tile-dense layout rather than a handful of oversized cards.
//
// "Aujourd'hui" panel — every signal that describes how the body is doing
// right now (Forme/Récupération/Sommeil rings + HRV/FC repos) lives inside
// one lime-tinted panel, same treatment as the Riegel tile
// (bg-primary/5 border-primary/20) — chosen over a design-canvas draft
// that used a black bg-foreground panel: user feedback, having reviewed
// that draft, "Le a avec le bloc mais pas en noir mais plus comme les
// couleurs de l'indice ri[e]del". The "Entraînement" grid below keeps only
// the training-load numbers (Riegel/CTL/ATL/FTP) — the two-zone split
// itself was already the shipped design ("un des premiers" for Riegel,
// the ring row for Forme/Récupération/Sommeil); this only changes the
// panel's color and pulls HRV/FC repos up into it.
//
// kJ budget and the internal load governor keep their own richer widgets
// (KJBudgetWidget/GovernorWidget) below this grid — they already handle
// "unavailable" states and multi-signal detail that don't compress into
// a single tile without losing real information.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Gauge, Zap, HeartPulse, Activity, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import { usePowerCurve } from './use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { RingGauge } from './ring-gauge'
import { tsbRingPercent, tsbRingColor, readinessRingColor, sleepRingPercent, sleepRingColor } from './ring-metrics'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { LogMetricDialog } from '@/components/lifestyle/log-metric-dialog'
import { previousValue, vitalTrend, formatSleepDuration, type VitalTrend } from '@/components/lifestyle/lifestyle-types'

function safeRound(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—'
  return String(Math.round(value))
}

// ── Small tile ───────────────────────────────────────────────────────

interface TileProps {
  label: string
  value: ReactNode
  unit?: string
  sublabel?: ReactNode
  href?: string
  className?: string
  /** Day-over-day trend vs yesterday — user feedback: "un petit indicateur... une petite led rouge/vert/jaune l'évolution vis à vis de la veille". Omit (or null) for a metric with no meaningful day-to-day "better direction" (Riegel, FTP, CTL...). */
  trend?: VitalTrend | null
}

/** The trend LED itself — a small colored dot, title-only explanation (no text label, the tile is dense enough already). */
function TrendDot({ trend }: { trend: VitalTrend | null | undefined }) {
  if (!trend) return null
  const cls = trend === 'good' ? 'bg-green-500' : trend === 'bad' ? 'bg-destructive' : 'bg-yellow-500'
  const title = trend === 'good' ? 'Mieux qu\'hier' : trend === 'bad' ? 'Moins bien qu\'hier' : 'Stable vs hier'
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', cls)} title={title} />
}

function MetricTile({ label, value, unit, sublabel, href, className, trend }: TileProps) {
  const content = (
    <div className={cn('lc-card p-4 flex flex-col justify-between h-[104px]', href && 'group', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {label}
          <TrendDot trend={trend} />
        </span>
        {href && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-data text-2xl font-bold">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sublabel && <div className="text-[11px] text-muted-foreground">{sublabel}</div>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

// ── "Aujourd'hui" panel — 3 rings (Forme/Récupération/Sommeil) + HRV/FC
// repos stats, all inside one lime-tinted surface ───────────────────────

/** No individual card behind a ring — RingItem sits directly on the shared panel, separated from its neighbors by a thin divider (see the panel wrapper below), same effect as MetricTile's border but shared across three items instead of drawn three times. */
const RING_TRACK_COLOR = 'hsl(var(--border))'

interface RingItemProps {
  href: string
  label: string
  percent: number
  color: string
  centerValue: ReactNode
  sublabel?: ReactNode
}

function RingItem({ href, label, percent, color, centerValue, sublabel }: RingItemProps) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center gap-2 group">
      <RingGauge percent={percent} color={color} trackColor={RING_TRACK_COLOR}>
        <span className="font-data text-lg font-bold text-foreground">{centerValue}</span>
      </RingGauge>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-0.5 text-center">
        {label}
        <ChevronRight className="w-3 h-3 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </span>
      {sublabel && <span className="text-[10px] text-muted-foreground/70 -mt-1">{sublabel}</span>}
    </Link>
  )
}

interface StatChipProps {
  href: string
  icon: LucideIcon
  label: string
  value: ReactNode
  unit?: string
  trend?: VitalTrend | null
}

// Icon + inline value/unit/label, centered — retro-fitted from the icon
// treatment on the landing-page mockup (public/screenshots/cycling.png),
// which the user singled out by name as their favorite part of that
// screenshot ("j'aime beaucoup... surtout les éléments pointés en rouge").
// Replaces the earlier label-above/value-below chip with no icon at all.
// The icon is a fixed "vital sign" red (text-destructive, the app's one
// red token) regardless of trend — the trend LED next to the label is
// still the good/bad/neutral-vs-yesterday signal, unchanged.
function StatChip({ href, icon: Icon, label, value, unit, trend }: StatChipProps) {
  return (
    <Link href={href} className="flex-1 flex items-center justify-center gap-2 group">
      <Icon className="w-4 h-4 text-destructive shrink-0" />
      <span className="font-data text-sm font-bold text-foreground">
        {value}
        {(unit || label) && (
          <span className="font-body text-[11px] font-normal text-muted-foreground normal-case tracking-normal ml-1">
            {unit}{unit && label ? ' ' : ''}{label}
          </span>
        )}
      </span>
      <TrendDot trend={trend} />
    </Link>
  )
}

export function PerformanceBento({ athlete }: { athlete: IntervalsAthlete }) {
  const powerCurve = usePowerCurve()
  const lifestyle = useLifestyleData()

  const enduranceIndex = fitEnduranceCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null

  const isAutoSynced = lifestyle.wellnessStatus.isConfigured && lifestyle.wellnessStatus.hasAnyEntry

  // Day-over-day trend LEDs (user feedback: "une petite led rouge/vert/jaune
  // l'évolution vis à vis de la veille") — only meaningful once there's both
  // a latest reading and a prior day to compare it against.
  const previousRestingHR = lifestyle.latest ? previousValue(lifestyle.dailySeries, lifestyle.latest.dayId, 'restingHR') : undefined

  return (
    <div className="space-y-4">
      {/* "Aujourd'hui" — every signal about how the body is doing right now
          (Forme/Récupération/Sommeil rings + HRV/FC repos) shares one panel,
          lime-tinted like the Riegel tile rather than a black bg-foreground
          block (user feedback after reviewing a design-canvas draft: "Le a
          avec le bloc mais pas en noir mais plus comme les couleurs de
          l'indice riegel"). */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Aujourd&apos;hui</p>
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5">
          <div className="flex items-stretch divide-x divide-primary/15">
            <RingItem
              href="/cycling/metric/tsb"
              label="Forme"
              percent={tsb != null ? tsbRingPercent(tsb) : 0}
              color={tsb != null ? tsbRingColor(tsb) : RING_TRACK_COLOR}
              centerValue={tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
            />
            <RingItem
              href="/cycling/metric/readiness"
              label="Récupération"
              percent={lifestyle.readiness ?? 0}
              color={lifestyle.readiness != null ? readinessRingColor(lifestyle.readiness) : RING_TRACK_COLOR}
              centerValue={lifestyle.readiness != null ? `${lifestyle.readiness}%` : '—'}
            />
            <RingItem
              href="/cycling/metric/sleep"
              label="Sommeil"
              percent={sleepRingPercent(lifestyle.latest?.sleepHours, lifestyle.latest?.sleepQuality)}
              color={sleepRingColor(lifestyle.latest?.sleepQuality)}
              centerValue={lifestyle.latest?.sleepHours != null ? formatSleepDuration(lifestyle.latest.sleepHours) : '—'}
              sublabel={lifestyle.latest?.sleepQuality != null ? `Qualité ${Math.round(lifestyle.latest.sleepQuality)}%` : undefined}
            />
          </div>

          <div className="h-px bg-primary/15 my-4" />

          <div className="flex gap-4">
            <StatChip
              href="/cycling/metric/hrv"
              icon={HeartPulse}
              label="HRV"
              value={lifestyle.latest?.hrv != null ? Math.round(lifestyle.latest.hrv) : '—'}
              unit={lifestyle.latest?.hrv != null ? 'ms' : undefined}
              // Pas de trend jour/veille ici — retiré (docs/AUDIT_CYCLING.md
              // §1.1) : une LED verte/rouge sur une seule comparaison
              // jour-à-jour codait l'affirmation interdite section 8 ("qu'une
              // baisse de HRV signifie fatigue et une hausse fraîcheur") et
              // violait principle-2 (jamais de décision sur une valeur
              // isolée) / principle-3 (le signe d'une variation de HRV est
              // ambigu, R25). La FC repos juste en dessous garde sa LED : R25
              // ne documente pas la FC repos comme ambiguë de la même façon.
            />
            <StatChip
              href="/cycling/metric/restingHr"
              icon={Activity}
              label="repos"
              value={lifestyle.latest?.restingHR != null ? Math.round(lifestyle.latest.restingHR) : '—'}
              unit={lifestyle.latest?.restingHR != null ? 'bpm' : undefined}
              trend={lifestyle.latest?.restingHR != null ? vitalTrend(lifestyle.latest.restingHR, previousRestingHR, 'lower-better') : undefined}
            />
          </div>
        </div>
      </div>

      {/* "Entraînement" — training-load numbers only; Riegel right after the panel per earlier user feedback ("un des premiers"), only shown when the athlete has entered power records */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Entraînement</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {enduranceIndex != null ? (
            <MetricTile
              label="Indice Riegel"
              value={enduranceIndex.toFixed(2)}
              sublabel={<span className="flex items-center gap-1 text-primary"><Gauge className="w-3 h-3" /> Endurance</span>}
              href="/cycling/metric/riegel"
              className="bg-primary/5 border-primary/20"
            />
          ) : (
            <MetricTile label="Fitness (CTL)" value={safeRound(athlete.ctl)} sublabel="Charge chronique" href="/cycling/metric/ctl" />
          )}

          {enduranceIndex != null && <MetricTile label="Fitness (CTL)" value={safeRound(athlete.ctl)} sublabel="Charge chronique" href="/cycling/metric/ctl" />}
          <MetricTile label="Fatigue (ATL)" value={safeRound(athlete.atl)} sublabel="Charge aiguë" href="/cycling/metric/atl" />
          <MetricTile
            label="FTP"
            value={athlete.ftp ?? '—'}
            unit="W"
            sublabel={athlete.ftp && athlete.weight && athlete.weight > 0 ? `${(athlete.ftp / athlete.weight).toFixed(2)} W/kg` : undefined}
            href="/cycling/metric/ftp"
          />
        </div>
      </div>

      <div className="pt-1">
        <LogMetricDialog isAutoSynced={isAutoSynced} />
      </div>
      {enduranceIndex == null && powerCurve.data == null && !powerCurve.isLoading && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Renseignez vos records de puissance (page détail Indice Riegel) pour débloquer l&apos;indice Riegel.
        </p>
      )}
    </div>
  )
}
