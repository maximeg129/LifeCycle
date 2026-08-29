"use client"

// ── "Vue d'ensemble" — dense metric-tile grid for Cyclisme ─────────────
//
// Every metric the coach IA actually uses, at a glance — inspired by
// Whoop's tile-dense layout rather than a handful of oversized cards.
// TSB (the "should I push today?" number) stays the one hero tile;
// everything else — including sleep/HRV/readiness, previously only on
// Vie & Santé — is a small tile in the same grid, since that page is no
// longer in the primary nav (see AUDIT.md/PLAN.md design-identity work).
// Riegel's endurance index sits right after TSB per user feedback ("un
// des premiers"), not buried at the end.
//
// kJ budget and the internal load governor keep their own richer widgets
// (KJBudgetWidget/GovernorWidget) below this grid — they already handle
// "unavailable" states and multi-signal detail that don't compress into
// a single tile without losing real information.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ChevronRight, Gauge, Moon, Activity as ActivityIcon, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import { usePowerCurve } from './use-power-curve'
import { fitPowerDurationCurve, type PowerRecord } from './riegel-types'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { LogMetricDialog } from '@/components/lifestyle/log-metric-dialog'

function tsbLabel(tsb: number): { text: string; className: string } {
  if (tsb > 25) return { text: 'Très reposé', className: 'text-chart-4' }
  if (tsb > 5) return { text: 'Forme optimale', className: 'text-primary' }
  if (tsb > -10) return { text: 'En charge', className: 'text-chart-2' }
  return { text: 'Fatigue élevée', className: 'text-destructive' }
}

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

export function PerformanceBento({ athlete }: { athlete: IntervalsAthlete }) {
  const powerCurve = usePowerCurve()
  const lifestyle = useLifestyleData()

  const enduranceIndex = fitPowerDurationCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null
  const label = tsbLabel(tsb ?? 0)

  const isAutoSynced = lifestyle.wellnessStatus.isConfigured && lifestyle.wellnessStatus.hasAnyEntry

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Hero — TSB */}
        <Link href="/cycling/metric/tsb" className="col-span-2 row-span-2 rounded-2xl bg-foreground text-background p-6 flex flex-col justify-between shadow-lg group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-background/60">Forme · TSB</span>
            <ChevronRight className="w-4 h-4 text-background/40 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="font-data text-6xl font-bold text-primary my-3">
            {tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
          </div>
          <div className={cn('flex items-center gap-2 text-xs', label.className)}>
            {tsb == null || tsb >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="text-background/70">{tsb != null ? label.text : 'Données indisponibles'}</span>
          </div>
        </Link>

        {/* Riegel — right after TSB, only when the athlete has entered power records */}
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

        {/* Recovery — moved from Vie & Santé, now primary here */}
        <MetricTile
          label="Sommeil"
          value={lifestyle.latest?.sleepHours ?? '—'}
          unit={lifestyle.latest?.sleepHours != null ? 'h' : undefined}
          sublabel={lifestyle.latest?.sleepQuality != null ? `Qualité ${lifestyle.latest.sleepQuality}%` : undefined}
          href="/cycling/metric/sleep"
        />
        <MetricTile
          label="HRV"
          value={lifestyle.latest?.hrv ?? '—'}
          unit={lifestyle.latest?.hrv != null ? 'ms' : undefined}
          href="/cycling/metric/hrv"
        />
        <MetricTile
          label="Readiness"
          value={lifestyle.readiness ?? '—'}
          unit={lifestyle.readiness != null ? '/100' : undefined}
          sublabel={lifestyle.readiness != null ? (lifestyle.readiness > 75 ? "Prêt pour l'effort" : lifestyle.readiness > 50 ? 'Effort modéré' : 'Récupération') : undefined}
          href="/cycling/metric/readiness"
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
