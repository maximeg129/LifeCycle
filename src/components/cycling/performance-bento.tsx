"use client"

// ── "Aujourd'hui" — readiness panel ─────────────────────────────────────
//
// Refonte structurelle, retour utilisateur (captures d'écran : référence vs
// "le site en prod") : "en jaune la section doit se limiter seulement a ces
// indicateurs et dans ce format de presentation" — la référence ne montre
// QUE la carte ReadinessStrip sur Aujourd'hui, jamais la grille "Entraînement"
// (Riegel/CTL/ATL/FTP/Puissance critique) que le prod affichait en plus.
// `AskUserQuestion` avant de retirer (risque de perdre une fonctionnalité de
// visibilité construite exprès lors d'audits antérieurs, voir CLAUDE.md) :
// confirmé — "Remove it from Aujourd'hui". CTL/ATL restent visibles via la
// légende de la cellule "Forme (TSB)" de ReadinessStrip (formeTrendCaption) ;
// Riegel/FTP/Puissance critique n'ont plus de point d'entrée direct depuis
// cette page (leurs pages détail /cycling/metric/[id] existent toujours,
// simplement plus liées depuis ici — compromis explicitement accepté par
// l'utilisateur après que la question le précise).
//
// kJ budget / gouverneur / PMC (courbe 12 semaines + charge hebdo) ont
// déménagé vers /plan (voir plan-tab.tsx) — même retour utilisateur ("en
// rouge le plan pour le semaine (simplifié)"), `AskUserQuestion` confirmée :
// "Move them off Aujourd'hui entirely".

import { format } from 'date-fns'
import type { IntervalsAthlete } from '@/lib/intervals-api'
import { ReadinessStrip } from './readiness-strip'
import { useLifestyleData } from '@/components/lifestyle/use-lifestyle-data'
import { readinessBaselineLookbackDays } from '@/components/lifestyle/lifestyle-types'
import type { DatedValue } from './governor-types'

// ReadinessStrip a besoin de ≥35j d'historique HRV/FC repos pour
// vitalsTrendCaption (7j récents + 28j de ligne de base, windowedTrendSignal
// — même fenêtre que le gouverneur de charge interne). readinessBaselineLookbackDays()
// réutilise la même constante que computeReadiness() plutôt qu'un chiffre
// inventé pour l'occasion.
const READINESS_STRIP_HISTORY_DAYS = 7 + readinessBaselineLookbackDays()

export function PerformanceBento({ athlete }: { athlete: IntervalsAthlete }) {
  const lifestyle = useLifestyleData(READINESS_STRIP_HISTORY_DAYS)

  const rawTsb = athlete.tsb
  const tsb = rawTsb != null && !isNaN(rawTsb) ? Math.round(rawTsb) : null

  // Séries datées pour les légendes de tendance de ReadinessStrip — toutes
  // déjà chargées par useLifestyleData(READINESS_STRIP_HISTORY_DAYS)
  // ci-dessus, aucun nouveau fetch réseau. `dayId` renommé `date` pour
  // matcher DatedValue (governor-types.ts) — même forme que
  // windowedTrendSignal attend déjà.
  const readinessHistory: DatedValue[] = lifestyle.readinessSeries.map((r) => ({ date: r.dayId, value: r.value }))
  const hrvHistory: DatedValue[] = lifestyle.dailySeries.filter((d) => d.hrv != null).map((d) => ({ date: d.dayId, value: d.hrv as number }))
  const restingHrHistory: DatedValue[] = lifestyle.dailySeries.filter((d) => d.restingHR != null).map((d) => ({ date: d.dayId, value: d.restingHR as number }))
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  return (
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
  )
}
