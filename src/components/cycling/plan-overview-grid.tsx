"use client"

// ── Grille compacte du plan entier ───────────────────────────────────────
//
// Retour utilisateur : "c'est pas idéal encore des long scroll beaucoup
// d'info et on peut se perdre... un peu à l'exemple de intervals". La vue
// semaine (plan-week-calendar.tsx) montre une semaine à la fois en détail ;
// cette grille donne l'orientation inverse — TOUT le plan d'un coup d'œil,
// une ligne compacte par semaine, pour naviguer directement à la semaine
// voulue sans dérouler 12 cartes à la suite.
//
// ⚠️ Restructuration lifecycle-ui-reference.html (`.wk`, voir CLAUDE.md
// "Refonte UI/IA... Work Package D") : remplace l'ancienne prévisualisation
// "7 pastilles de couleur par jour" par une seule barre réalisé/prévu par
// semaine (weekAdherencePercent, training-plan-types.ts — même donnée que
// PlanAdherenceChart, pas une deuxième lecture) + une colonne Heures à
// droite, dans une grille à 4 colonnes avec en-tête (Sem./Contenu/Réalisé-
// prévu/Heures). Une semaine pas encore générée (sampleSessions lazy)
// affiche toujours le badge de sa phase plutôt qu'une barre vide sans
// contexte — PHASE_LABELS/PHASE_BADGE_CLASS, inchangé depuis la version
// précédente de ce composant.
//
// La semaine sélectionnée s'ouvre toujours directement sous sa propre
// ligne (renderExpanded) plutôt que dans un bloc séparé sous toute la
// grille — retour utilisateur : "j'irai mettre chaque séance
// d'entraînement de la semaine en cours directement sous la semaine en
// cours."

import { useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  PHASE_LABELS, PHASE_BADGE_CLASS, computeWeeklyAdherence, weekAdherencePercent,
  type PlanWeek, type PlanWeekSessionWithValidation, type SessionCompletion, type WeeklyAdherence,
} from './training-plan-types'

interface Props {
  weeks: PlanWeek[]
  selectedWeekNumber: number | null
  onSelectWeek: (weekNumber: number) => void
  getCompletion: (week: PlanWeek, session: PlanWeekSessionWithValidation, index: number) => SessionCompletion
  /** yyyy-MM-dd — pour l'adhérence réalisé/prévu de chaque ligne (voir WeekRow) et le fond "semaine en cours". */
  todayIso: string
  /** Contenu affiché directement sous la ligne de la semaine sélectionnée — voir ⚠️ ci-dessus. */
  renderExpanded: (week: PlanWeek) => ReactNode
}

export function PlanOverviewGrid({ weeks, selectedWeekNumber, onSelectWeek, getCompletion, todayIso, renderExpanded }: Props) {
  // Calculé une seule fois pour tout le plan (pas par ligne) — même donnée
  // que PlanAdherenceChart, jamais une deuxième lecture de getCompletion.
  const adherenceByWeek = useMemo(() => {
    const map = new Map<number, WeeklyAdherence>()
    for (const a of computeWeeklyAdherence(weeks, getCompletion, todayIso, weeks.length)) map.set(a.weekNumber, a)
    return map
  }, [weeks, getCompletion, todayIso])

  return (
    <div className="space-y-1">
      {/* En-tête de colonnes — même grille que les lignes ci-dessous, masqué sur mobile avec la colonne barre elle-même. */}
      <div className="hidden sm:grid grid-cols-[56px_1fr_120px_56px] gap-3 px-2.5 pb-1 text-xs text-subtle">
        <span>Sem.</span>
        <span>Contenu</span>
        <span>Réalisé / prévu</span>
        <span className="text-right">Heures</span>
      </div>
      {weeks.map((week) => {
        const isSelected = week.weekNumber === selectedWeekNumber
        return (
          <div key={week.weekNumber}>
            <WeekRow
              week={week}
              isSelected={isSelected}
              isCurrent={week.startDate <= todayIso && todayIso <= week.endDate}
              onSelect={() => onSelectWeek(week.weekNumber)}
              adherencePercent={weekAdherencePercent(adherenceByWeek.get(week.weekNumber))}
            />
            {isSelected && <div className="pt-2 pb-1">{renderExpanded(week)}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** good si la semaine a atteint ~80% de son volume prévu, warn sinon — honnête sur les vraies valeurs, jamais un 3e palier inventé. */
function barColor(percent: number, isCurrentWeek: boolean): string {
  if (isCurrentWeek) return 'hsl(var(--primary))'
  return percent >= 80 ? 'hsl(var(--good))' : 'hsl(var(--warn))'
}

function WeekRow({ week, isSelected, isCurrent, onSelect, adherencePercent }: {
  week: PlanWeek
  isSelected: boolean
  isCurrent: boolean
  onSelect: () => void
  adherencePercent: number | null
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full grid grid-cols-[56px_1fr_56px] sm:grid-cols-[56px_1fr_120px_56px] gap-3 items-center p-2.5 rounded-xl border text-left transition-colors',
        isSelected ? 'border-primary/40 bg-primary/5' : isCurrent ? 'border-transparent bg-primary/[0.04]' : 'border-transparent hover:bg-muted/40'
      )}
    >
      <span className={cn('font-data text-xs', isCurrent ? 'font-semibold text-foreground' : 'text-subtle')}>S{week.weekNumber}</span>
      <div className="min-w-0">
        <p className={cn('text-sm truncate', isCurrent && 'font-semibold')}>{week.focus}</p>
        {!week.sampleSessions && (
          // Semaine pas encore générée (sampleSessions lazy) — badge de phase
          // plutôt qu'une barre vide sans contexte, voir ⚠️ en tête de fichier.
          <span className={cn('inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md', PHASE_BADGE_CLASS[week.phase])}>
            {PHASE_LABELS[week.phase]}
          </span>
        )}
      </div>
      {/* Barre réalisé/prévu — masquée sur mobile (<640px), même que la référence (`.wk .bar{display:none}` en media query étroite) : pas assez de place pour une 4e colonne lisible. */}
      <div className="hidden sm:block h-1.5 rounded-full bg-muted overflow-hidden">
        {adherencePercent != null && (
          <div className="h-full rounded-full" style={{ width: `${Math.max(4, adherencePercent)}%`, backgroundColor: barColor(adherencePercent, isCurrent) }} />
        )}
      </div>
      <span className="font-data text-xs text-subtle text-right whitespace-nowrap">{Math.round(week.targetWeeklyMinutes / 60 * 10) / 10}h</span>
    </button>
  )
}
