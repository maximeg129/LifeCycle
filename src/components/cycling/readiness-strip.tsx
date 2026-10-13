"use client"

// ── <ReadinessStrip> — restructuration complète (lifecycle-ui-reference.
// html, voir CLAUDE.md) : "one card, 5 cells: verdict (icon tile + title +
// sentence), then Forme, Récupération, Sommeil, HRV·FC. Each cell has a
// confidence dot (good/warn/bad/unknown), a mono value and a trend
// caption." Remplace le panneau RingItem×3/StatChip×2 de
// performance-bento.tsx — même donnée (tsb/readiness/sommeil/hrv/FC
// repos/ctl/atl), reclassée en cellules compactes.
//
// ⚠️ La version précédente de ce composant affichait une mini sparkline
// SVG sous chaque valeur — remplacée par une légende TEXTE (voir
// readiness-strip-types.ts) pour matcher exactement la référence
// affinée, qui montre "CTL 48 · ATL 44"/"↓ 8 vs moy. 7 j"/"Qualité 87 %"/
// "Dans ta norme" plutôt qu'un tracé.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, AlertTriangle, AlertOctagon, HelpCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type Confidence,
  tsbConfidence,
  readinessConfidence,
  sleepConfidence,
  vitalsConfidence,
  buildReadinessVerdict,
  formeTrendCaption,
  windowAverageTrendCaption,
  sleepTrendCaption,
  vitalsTrendCaption,
} from './readiness-strip-types'
import { formatSleepDuration } from '@/components/lifestyle/lifestyle-types'
import type { DatedValue } from './governor-types'

// Tokens posés à l'étape 1 (globals.css/tailwind.config.ts) — good/warn/
// bad/unknown, consommés ici pour le point de confiance, le badge de
// verdict ET la couleur du delta (Récupération uniquement — les 3 autres
// légendes de tendance restent neutres, voir plus bas).
const CONFIDENCE_DOT_CLASS: Record<Confidence, string> = {
  good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-muted-foreground', unknown: 'bg-unknown',
}
const CONFIDENCE_BADGE_CLASS: Record<Confidence, string> = {
  good: 'bg-good-soft text-good', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad',
  neutral: 'bg-muted text-muted-foreground', unknown: 'bg-muted text-unknown',
}
const CONFIDENCE_BADGE_ICON: Record<Confidence, LucideIcon> = {
  good: Check, warn: AlertTriangle, bad: AlertOctagon, neutral: HelpCircle, unknown: HelpCircle,
}
const CONFIDENCE_TEXT_CLASS: Record<Confidence, string> = {
  good: 'text-good', warn: 'text-warn', bad: 'text-bad', neutral: 'text-subtle', unknown: 'text-subtle',
}
const CONFIDENCE_TITLE: Record<Confidence, string> = {
  good: 'Favorable', warn: 'Vigilance', bad: 'Signal défavorable', neutral: 'Donnée connue', unknown: 'Pas de donnée',
}

function ConfidenceDot({ confidence, title }: { confidence: Confidence; title: string }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', CONFIDENCE_DOT_CLASS[confidence])} title={title} />
}

interface CellProps {
  href: string
  label: string
  confidence: Confidence
  value: ReactNode
  unit?: string
  /** Légende de tendance — texte, jamais une sparkline (voir le commentaire de tête du fichier). */
  trendText?: string | null
  /** 'confidence' colore la légende comme le point (ex. Récupération) ; sinon toujours neutre (text-subtle). */
  trendColor?: 'confidence' | 'neutral'
}

function Cell({ href, label, confidence, value, unit, trendText, trendColor = 'neutral' }: CellProps) {
  return (
    <Link href={href} className="flex flex-col gap-1 px-4 sm:px-5 py-4 min-w-0">
      <span className="text-xs font-medium text-subtle flex items-center gap-1.5 truncate">
        <ConfidenceDot confidence={confidence} title={CONFIDENCE_TITLE[confidence]} />
        {label}
      </span>
      <span className="font-data text-2xl font-bold leading-tight truncate">
        {value}
        {unit && <small className="font-body text-[13px] font-medium text-subtle ml-0.5 normal-case">{unit}</small>}
      </span>
      {trendText ? (
        <span className={cn('text-xs', trendColor === 'confidence' ? CONFIDENCE_TEXT_CLASS[confidence] : 'text-subtle')}>
          {trendText}
        </span>
      ) : (
        <span className="text-xs text-subtle">&nbsp;</span>
      )}
    </Link>
  )
}

export interface ReadinessStripProps {
  tsb: number | null
  readiness: number | null
  ctl: number | null | undefined
  atl: number | null | undefined
  sleepHours: number | null | undefined
  sleepQuality: number | null | undefined
  hrv: number | null | undefined
  restingHR: number | null | undefined
  /** `lifestyle.readinessSeries` (déjà calculé par useLifestyleData()) — pour la légende "vs moy. N j" de Récupération. */
  readinessHistory: DatedValue[]
  /** `lifestyle.dailySeries` filtré sur hrv/restingHR — pour "Dans ta norme" (vitalsTrendCaption, ≥35j nécessaires). */
  hrvHistory: DatedValue[]
  restingHrHistory: DatedValue[]
  todayIso: string
}

export function ReadinessStrip({
  tsb, readiness, ctl, atl, sleepHours, sleepQuality, hrv, restingHR,
  readinessHistory, hrvHistory, restingHrHistory, todayIso,
}: ReadinessStripProps) {
  const verdict = buildReadinessVerdict(tsb, readiness)
  const BadgeIcon = CONFIDENCE_BADGE_ICON[verdict.confidence]
  const vitals = vitalsConfidence(hrv, restingHR)
  const vitalsValue = hrv != null || restingHR != null
    ? [hrv != null ? `${Math.round(hrv)} ms` : '—', restingHR != null ? `${Math.round(restingHR)} bpm` : '—'].join(' · ')
    : '—'

  return (
    <div className="lc-card p-0 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-[1.3fr_repeat(4,1fr)] divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Verdict — pleine largeur sur mobile (2 colonnes), 1ère cellule sur desktop. Badge icône dans un cercle coloré, pas un simple point — voir .verdict .badge de la référence. */}
        <Link href="/cycling/metric/tsb" className="col-span-2 sm:col-span-1 flex items-start gap-3 px-4 sm:px-5 py-4 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', CONFIDENCE_BADGE_CLASS[verdict.confidence])}>
            <BadgeIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{verdict.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{verdict.sentence}</p>
          </div>
        </Link>

        <Cell
          href="/cycling/metric/tsb"
          label="Forme (TSB)"
          confidence={tsbConfidence(tsb)}
          value={tsb != null ? (tsb > 0 ? `+${tsb}` : tsb) : '—'}
          trendText={formeTrendCaption(ctl, atl)}
        />
        <Cell
          href="/cycling/metric/readiness"
          label="Récupération"
          confidence={readinessConfidence(readiness)}
          value={readiness != null ? readiness : '—'}
          unit={readiness != null ? '%' : undefined}
          trendText={windowAverageTrendCaption(readinessHistory, todayIso)}
          trendColor="confidence"
        />
        <Cell
          href="/cycling/metric/sleep"
          label="Sommeil"
          confidence={sleepConfidence(sleepQuality)}
          value={sleepHours != null ? formatSleepDuration(sleepHours) : '—'}
          trendText={sleepTrendCaption(sleepQuality)}
        />
        <Cell
          href="/cycling/metric/hrv"
          label="HRV · FC repos"
          confidence={vitals}
          value={vitalsValue}
          trendText={vitalsTrendCaption(hrvHistory, restingHrHistory, todayIso)}
        />
      </div>
    </div>
  )
}
