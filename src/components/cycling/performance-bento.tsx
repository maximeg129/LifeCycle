"use client"

// ── "Vue d'ensemble" — dense metric-tile grid for Cyclisme ─────────────
//
// Every metric the coach IA actually uses, at a glance — inspired by
// Whoop's tile-dense layout rather than a handful of oversized cards.
// Forme (TSB)/Récupération (Readiness)/Sommeil open the page as a
// 3-across ring row (RingTile, Whoop-style circular gauges — user
// feedback, a screenshot of Whoop's own ring layout) since those three
// are "how am I today?" signals read together at a glance, not standalone
// numbers; everything else — including HRV, previously only on Vie &
// Santé — is a small flat tile in the grid below, since that page is no
// longer in the primary nav (see AUDIT.md/PLAN.md design-identity work).
// Riegel's endurance index sits right after the ring row per earlier user
// feedback ("un des premiers"), not buried at the end.
//
// kJ budget and the internal load governor keep their own richer widgets
// (KJBudgetWidget/GovernorWidget) below this grid — they already handle
// "unavailable" states and multi-signal detail that don't compress into
// a single tile without losing real information.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, Gauge, Moon, Activity as ActivityIcon, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import { usePowerCurve } from './use-power-curve'
import { fitPowerDurationCurve, type PowerRecord } from './riegel-types'
import { RingGauge } from './ring-gauge'
import { tsbRingPercent, tsbRingColor, readinessRingColor, sleepRingPercent, sleepRingColor } from './ring-metrics'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { LogMetricDialog } from '@/components/lifestyle/log-metric-dialog'

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
}

function MetricTile({ label, value, unit, sublabel, href, className }: TileProps) {
  const content = (
    <div className={cn('lc-card p-4 flex flex-col justify-between h-[104px]', href && 'group', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
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

// ── Ring tile — the 3-across "état de forme" row (Forme/Récupération/
// Sommeil), Whoop-style ─────────────────────────────────────────────────

interface RingTileProps {
  href: string
  label: string
  percent: number
  color: string
  centerValue: ReactNode
  sublabel?: ReactNode
}

function RingTile({ href, label, percent, color, centerValue, sublabel }: RingTileProps) {
  return (
    <Link href={href} className="rounded-2xl bg-foreground p-4 flex flex-col items-center gap-2 shadow-lg group">
      <RingGauge percent={percent} color={color}>
        <span className="font-data text-lg font-bold text-background">{centerValue}</span>
      </RingGauge>
      <span className="text-[10px] font-medium uppercase tracking-wider text-background/70 flex items-center gap-0.5 text-center">
        {label}
        <ChevronRight className="w-3 h-3 text-background/40 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </span>
      {sublabel && <span className="text-[10px] text-background/50 -mt-1">{sublabel}</span>}
    </Link>
  )
}

export function PerformanceBento({ athlete }: { athlete: IntervalsAthlete }) {
  const powerCurve = usePowerCurve()
  const lifestyle = useLifestyleData()

  const enduranceIndex = fitPowerDurationCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null

  const isAutoSynced = lifestyle.wellnessStatus.isConfigured && lifestyle.wellnessStatus.hasAnyEntry

  return (
    <div className="space-y-3">
      {/* Forme / Récupération / Sommeil — Whoop-style ring row, user feedback ("forme tsb - readiness -
          sommeil (heure et qualité), peux ton avoir... représenté de cette façon ?"). Replaces the old
          TSB-only hero tile + the separate Sommeil/Readiness MetricTiles below. */}
      <div className="grid grid-cols-3 gap-3">
        <RingTile
          href="/cycling/metric/tsb"
          label="Forme"
          percent={tsb != null ? tsbRingPercent(tsb) : 0}
          color={tsb != null ? tsbRingColor(tsb) : 'rgba(255,255,255,0.14)'}
          centerValue={tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
        />
        <RingTile
          href="/cycling/metric/readiness"
          label="Récupération"
          percent={lifestyle.readiness ?? 0}
          color={lifestyle.readiness != null ? readinessRingColor(lifestyle.readiness) : 'rgba(255,255,255,0.14)'}
          centerValue={lifestyle.readiness != null ? `${lifestyle.readiness}%` : '—'}
        />
        <RingTile
          href="/cycling/metric/sleep"
          label="Sommeil"
          percent={sleepRingPercent(lifestyle.latest?.sleepHours, lifestyle.latest?.sleepQuality)}
          color={sleepRingColor(lifestyle.latest?.sleepQuality)}
          centerValue={lifestyle.latest?.sleepHours != null ? `${lifestyle.latest.sleepHours}h` : '—'}
          sublabel={lifestyle.latest?.sleepQuality != null ? `Qualité ${lifestyle.latest.sleepQuality}%` : undefined}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Riegel — right after the ring row per earlier user feedback ("un des premiers"), only when the athlete has entered power records */}
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
        <MetricTile
          label="HRV"
          value={lifestyle.latest?.hrv ?? '—'}
          unit={lifestyle.latest?.hrv != null ? 'ms' : undefined}
          href="/cycling/metric/hrv"
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <LogMetricDialog isAutoSynced={isAutoSynced} />
        <Link href="/lifestyle" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5" /> Objectifs, analyse IA &amp; historique complet
          <ActivityIcon className="w-3 h-3" />
        </Link>
      </div>
      {enduranceIndex == null && powerCurve.data == null && !powerCurve.isLoading && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Renseignez vos records de puissance (section PMC plus bas) pour débloquer l&apos;indice Riegel.
        </p>
      )}
    </div>
  )
}
