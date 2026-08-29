"use client"

// ── Flagship stat layout for the Cyclisme "Entraînement" tab ───────────
//
// Replaces the plain 4-equal-column stat row with a bento layout: a hero
// tile for TSB (the number that actually answers "should I push today?"),
// a tighter stat trio (CTL/ATL/FTP), a couple of "discover" tiles that
// tease data the user might not think to go looking for (Riegel endurance
// index — only shown once the user has entered power records, never
// fabricated), and a cross-domain strip reusing the same merged sleep/HRV/
// readiness series now wired into the daily workout proposal — real data
// already computed elsewhere in the app, not a second source of truth.
// Mobile-first: the bento collapses to a single column below `lg`.

import Link from 'next/link'
import { TrendingUp, TrendingDown, ChevronRight, Moon, Activity as ActivityIcon, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import type { GovernorStatus } from './load-types'
import { usePowerCurve } from './use-power-curve'
import { fitPowerDurationCurve, type PowerRecord } from './riegel-types'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'

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

const GOVERNOR_LABEL: Record<GovernorStatus, string> = {
  vert: 'Favorable',
  orange: 'Stable',
  rouge: 'Dégradé',
  insufficient_data: 'Données insuffisantes',
}

export function PerformanceBento({ athlete, governorStatus }: { athlete: IntervalsAthlete; governorStatus: GovernorStatus }) {
  const powerCurve = usePowerCurve()
  const lifestyle = useLifestyleData()

  const enduranceIndex = fitPowerDurationCurve(
    [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  )?.enduranceIndex ?? null

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null
  const label = tsbLabel(tsb ?? 0)

  const chips: { label: string; colorClass: string }[] = []
  if (lifestyle.latest?.sleepHours != null) chips.push({ label: `Sommeil ${lifestyle.latest.sleepHours}h`, colorClass: 'bg-chart-3/10 text-chart-3' })
  if (lifestyle.latest?.hrv != null) chips.push({ label: `HRV ${lifestyle.latest.hrv}ms`, colorClass: 'bg-chart-4/10 text-chart-4' })
  if (lifestyle.readiness != null) chips.push({ label: `Readiness ${lifestyle.readiness}/100`, colorClass: 'bg-chart-2/10 text-chart-2' })
  chips.push({ label: `Charge interne ${GOVERNOR_LABEL[governorStatus].toLowerCase()}`, colorClass: 'bg-primary/10 text-primary' })

  return (
    <div className="space-y-4">
      {/* hero TSB + CTL/ATL/FTP trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-[280px_1fr_1fr_1fr] gap-3">
        <div className="lg:row-span-2 rounded-2xl bg-foreground text-background p-6 flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-medium uppercase tracking-wider text-background/60">Forme · TSB</span>
          <div className="font-data text-6xl font-bold text-primary my-3">
            {tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
          </div>
          <div className={cn('flex items-center gap-2 text-xs', label.className)}>
            {tsb == null || tsb >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="text-background/70">{tsb != null ? label.text : 'Données indisponibles'}</span>
          </div>
        </div>

        <div className="lc-card p-5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fitness (CTL)</span>
          <div className="font-data text-3xl font-bold mt-2">{safeRound(athlete.ctl)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Charge chronique</div>
        </div>
        <div className="lc-card p-5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fatigue (ATL)</span>
          <div className="font-data text-3xl font-bold mt-2">{safeRound(athlete.atl)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((athlete.atl ?? 0) / Math.max(athlete.ctl ?? 1, 1)) * 100)}%` }} />
          </div>
        </div>
        <div className="lc-card p-5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">FTP</span>
          <div className="font-data text-3xl font-bold mt-2">
            {athlete.ftp ?? '—'}<span className="text-sm text-muted-foreground ml-1">W</span>
          </div>
          {athlete.ftp && athlete.weight && athlete.weight > 0 && (
            <div className="mt-1 text-[11px] text-muted-foreground">{(athlete.ftp / athlete.weight).toFixed(2)} W/kg</div>
          )}
        </div>

        {/* discover tile — only when the athlete has actually entered power records */}
        {enduranceIndex != null && (
          <Link href="/lifestyle" className="lc-card p-5 bg-primary/5 border-primary/20 hover:border-primary/40 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Indice d&apos;endurance
              </span>
              <ChevronRight className="w-4 h-4 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="font-data text-2xl font-bold text-primary mt-2">{enduranceIndex.toFixed(2)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Riegel — voir l&apos;analyse de récupération</div>
          </Link>
        )}
      </div>

      {/* cross-domain discovery strip — real data already computed elsewhere in the app */}
      {chips.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mr-1">
            <ActivityIcon className="w-3.5 h-3.5" /> Cette semaine
          </span>
          {chips.map((c) => (
            <span key={c.label} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', c.colorClass)}>
              {c.label}
            </span>
          ))}
          <Link href="/lifestyle" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 ml-auto">
            <Moon className="w-3.5 h-3.5" /> Voir Vie &amp; Santé
          </Link>
        </div>
      )}
    </div>
  )
}
