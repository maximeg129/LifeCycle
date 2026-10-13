"use client"

// ── "Vue d'ensemble" — dense metric-tile grid for Cyclisme ─────────────
//
// Every metric the coach IA actually uses, at a glance — inspired by
// Whoop's tile-dense layout rather than a handful of oversized cards.
//
// ⚠️ "Aujourd'hui" panel — refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md
// §3.3/§5) : les 3 anneaux Forme/Récupération/Sommeil + les 2 StatChip
// HRV/FC repos sont remplacés par <ReadinessStrip> ("Replaces the 3
// rings" — voir readiness-strip.tsx) — une seule carte à 5 cellules avec
// un point de confiance good/warn/bad/unknown par cellule plutôt que des
// anneaux sans cette distinction honnête (un anneau plein pouvait déjà se
// peindre vert par défaut même sans donnée, voir sleepRingColor/
// readinessRingColor ci-dessous, désormais supprimées). La grille
// "Entraînement" (Riegel/CTL/ATL/FTP/Puissance critique) n'a pas changé.
//
// kJ budget and the internal load governor keep their own richer widgets
// (KJBudgetWidget/GovernorWidget) below this grid — they already handle
// "unavailable" states and multi-signal detail that don't compress into
// a single tile without losing real information.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronRight, Gauge, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import { usePowerCurve } from './use-power-curve'
import { fitEnduranceCurve, type PowerRecord } from '@/domain/cycling/metrics/endurance'
import { fitCriticalPower } from '@/domain/cycling/metrics/criticalPower'
import { ReadinessStrip } from './readiness-strip'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { readinessBaselineLookbackDays } from '@/components/lifestyle/lifestyle-types'
import { LogMetricDialog } from '@/components/lifestyle/log-metric-dialog'
import type { DatedValue } from './governor-types'

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
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {href && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-data text-2xl font-bold">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

// ReadinessStrip a besoin de ≥35j d'historique HRV/FC repos pour
// vitalsTrendCaption (7j récents + 28j de ligne de base, windowedTrendSignal
// — même fenêtre que le gouverneur de charge interne). readinessBaselineLookbackDays()
// réutilise la même constante que computeReadiness() plutôt qu'un chiffre
// inventé pour l'occasion.
const READINESS_STRIP_HISTORY_DAYS = 7 + readinessBaselineLookbackDays()

export function PerformanceBento({ athlete }: { athlete: IntervalsAthlete }) {
  const powerCurve = usePowerCurve()
  const lifestyle = useLifestyleData(READINESS_STRIP_HISTORY_DAYS)

  const powerRecords = [powerCurve.data?.shortRecord, powerCurve.data?.mediumRecord, powerCurve.data?.longRecord].filter((r): r is PowerRecord => !!r)
  const enduranceIndex = fitEnduranceCurve(powerRecords)?.enduranceIndex ?? null
  // Retour utilisateur, audit des indicateurs Cyclisme : "mettre tous les
  // indicateurs que nous avons défini" — riegel-prefer-critical-power-
  // side-cycling (evidence/rules.ts) fait de ce modèle l'alternative à
  // privilégier côté vélo par rapport à Riegel (physiologiquement fondé,
  // pas un simple ajustement statistique) ; jamais affiché nulle part
  // avant ce correctif malgré la règle. Mêmes 3 records personnels que
  // Riegel — aucune saisie supplémentaire demandée à l'athlète.
  const criticalPowerModel = fitCriticalPower(powerRecords)

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null

  const isAutoSynced = lifestyle.wellnessStatus.isConfigured && lifestyle.wellnessStatus.hasAnyEntry

  // Séries datées pour les légendes de tendance de ReadinessStrip — toutes
  // déjà chargées par useLifestyleData(READINESS_STRIP_HISTORY_DAYS)
  // ci-dessus (élargi pour cette carte, voir son commentaire), aucun
  // nouveau fetch réseau. `dayId` renommé `date` pour matcher DatedValue
  // (governor-types.ts) — même forme que windowedTrendSignal attend déjà.
  const readinessHistory: DatedValue[] = lifestyle.readinessSeries.map((r) => ({ date: r.dayId, value: r.value }))
  const hrvHistory: DatedValue[] = lifestyle.dailySeries.filter((d) => d.hrv != null).map((d) => ({ date: d.dayId, value: d.hrv as number }))
  const restingHrHistory: DatedValue[] = lifestyle.dailySeries.filter((d) => d.restingHR != null).map((d) => ({ date: d.dayId, value: d.restingHR as number }))
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-4">
      {/* "Aujourd'hui" — ReadinessStrip remplace les 3 anneaux + les 2
          StatChip (voir le commentaire de tête de ce fichier). */}
      <ReadinessStrip
        tsb={tsb}
        readiness={lifestyle.readiness}
        ctl={athlete.ctl}
        atl={athlete.atl}
        sleepHours={lifestyle.latest?.sleepHours}
        sleepQuality={lifestyle.latest?.sleepQuality}
        hrv={lifestyle.latest?.hrv}
        restingHR={lifestyle.latest?.restingHR}
        readinessHistory={readinessHistory}
        hrvHistory={hrvHistory}
        restingHrHistory={restingHrHistory}
        todayIso={todayIso}
      />

      {/* "Entraînement" — training-load numbers only; Riegel right after the panel per earlier user feedback ("un des premiers"), only shown when the athlete has entered power records */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Entraînement</p>
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
          {criticalPowerModel != null && (
            <MetricTile
              label="Puissance critique"
              value={Math.round(criticalPowerModel.cpWatts)}
              unit="W"
              sublabel={`W′ ${(criticalPowerModel.wPrimeJoules / 1000).toFixed(1)} kJ`}
              href="/cycling/metric/criticalPower"
            />
          )}
        </div>
      </div>

      <div className="pt-1">
        <LogMetricDialog isAutoSynced={isAutoSynced} />
      </div>
      {enduranceIndex == null && powerCurve.data == null && !powerCurve.isLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Renseignez vos records de puissance (page détail Indice Riegel) pour débloquer l&apos;indice Riegel.
        </p>
      )}
    </div>
  )
}
