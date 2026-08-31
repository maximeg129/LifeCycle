// ── Coach context assembly — pure function, no Firebase deps ──────────────
//
// Instead of letting the LLM reconstruct context from raw logs on every call,
// this composes an explicit, human-readable text block from the structured
// Coach Memory documents plus the current load-model metrics (kJ budget,
// internal load governor, endurance index). The block is prefixed to the
// system prompt of any Claude call concerning training.

import { differenceInCalendarDays } from 'date-fns'
import type { GovernorStatus } from './load-types'
import type { InjuryStatus } from './coach-memory-types'
import { buildLibraryContextBlock, type LibraryEntryLike } from './library-types'

export interface CoachContextInjury {
  bodyRegion: string
  severity: number
  status: InjuryStatus
  startDate: string
  description: string
  physioInstructions: string
}

export interface CoachContextGoal {
  eventName: string
  eventDate: string
  targetOutcome: string
  priority: number
}

export interface CoachContextLifestyle {
  stress?: string
  sleepHabits?: string
  workConstraints?: string
  notes?: string
}

export interface CoachContextInput {
  /**
   * yyyy-MM-dd — required, not optional: this used to be absent entirely
   * (the LLM had no idea what "today" was, only whatever date labels
   * happened to be embedded in individual records), which made any
   * date-relative reasoning ("dans combien de jours ?", "cette semaine")
   * unreliable across every flow that shares this context, Stella's chat
   * included. Every call site can trivially supply
   * `format(new Date(), 'yyyy-MM-dd')`.
   */
  today: string
  injuries: CoachContextInjury[]
  lifestyle: CoachContextLifestyle | null
  goals: CoachContextGoal[]
  rememberedFacts: string[]
  kjBudget: { realized: number; target: number; baseline: number }
  governorStatus: GovernorStatus
  enduranceIndex?: number | null
  /**
   * Sources (études/articles/notes de coach) que l'athlète a ajoutées à sa
   * bibliothèque — retour utilisateur : "j'aimerais pouvoir completer le
   * coaching avec des documents solide, des etudes, des articles realisé
   * par des coachs, des entraineurs et des scientifique". Optionnel pour ne
   * pas casser un appelant qui n'a pas encore été mis à jour ; chaque hook
   * glue (use-daily-workout.ts, use-coach-chat.ts, use-training-plan.ts,
   * recovery-insight-panel.tsx, use-ride-analysis.ts) le fournit via
   * useCoachLibrary(). Seuls les résumés partent dans le prompt — jamais le
   * texte intégral, voir library-types.ts.
   */
  references?: LibraryEntryLike[]
}

function governorStatusLabel(status: GovernorStatus): string {
  switch (status) {
    case 'vert': return '🟢 Favorable (le budget peut augmenter)'
    case 'orange': return '🟠 Stable (ne pas augmenter)'
    case 'rouge': return '🔴 Dégradé (stabiliser ou réduire la charge)'
    default: return '⚪ Données insuffisantes pour statuer'
  }
}

/** Composes the structured coach-memory context block, in French, ready to prefix a system prompt. */
export function buildCoachContext(input: CoachContextInput): string {
  const lines: string[] = ['=== CONTEXTE COACH (mémoire structurée) ===']

  lines.push('', `AUJOURD'HUI : ${input.today}`)

  lines.push('', "CHARGE D'ENTRAÎNEMENT ACTUELLE :")
  lines.push(`- Budget kJ de la semaine : ${input.kjBudget.realized} kJ réalisés / ${input.kjBudget.target || '?'} kJ cible (base 8 semaines : ${input.kjBudget.baseline} kJ)`)
  lines.push(`- Gouverneur de charge interne : ${governorStatusLabel(input.governorStatus)}`)
  if (input.enduranceIndex != null) {
    lines.push(`- Indice d'endurance (Riegel) : ${input.enduranceIndex.toFixed(2)}`)
  }

  const activeInjuries = input.injuries.filter((i) => i.status === 'active')
  lines.push('', `BLESSURES (${activeInjuries.length} active${activeInjuries.length > 1 ? 's' : ''}) :`)
  if (input.injuries.length === 0) {
    lines.push('- Aucune blessure enregistrée.')
  } else {
    for (const i of input.injuries) {
      const statusLabel = i.status === 'active' ? 'active' : 'résolue'
      const physio = i.physioInstructions ? ` — Consignes kiné : ${i.physioInstructions}` : ''
      lines.push(`- ${i.bodyRegion} (sévérité ${i.severity}/5, ${statusLabel}, depuis ${i.startDate}) : ${i.description}${physio}`)
    }
  }

  lines.push('', 'STYLE DE VIE :')
  if (!input.lifestyle || !(input.lifestyle.stress || input.lifestyle.sleepHabits || input.lifestyle.workConstraints || input.lifestyle.notes)) {
    lines.push('- Non renseigné.')
  } else {
    if (input.lifestyle.stress) lines.push(`- Stress : ${input.lifestyle.stress}`)
    if (input.lifestyle.sleepHabits) lines.push(`- Sommeil habituel : ${input.lifestyle.sleepHabits}`)
    if (input.lifestyle.workConstraints) lines.push(`- Contraintes pro : ${input.lifestyle.workConstraints}`)
    if (input.lifestyle.notes) lines.push(`- Notes : ${input.lifestyle.notes}`)
  }

  lines.push('', 'OBJECTIFS :')
  if (input.goals.length === 0) {
    lines.push('- Aucun objectif enregistré.')
  } else {
    const today = new Date(`${input.today}T00:00:00`)
    const sorted = [...input.goals].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    for (const g of sorted) {
      const daysUntil = differenceInCalendarDays(new Date(`${g.eventDate}T00:00:00`), today)
      const distance = daysUntil < 0 ? `il y a ${-daysUntil} jours` : daysUntil === 0 ? "aujourd'hui" : `dans ${daysUntil} jours`
      lines.push(`- ${g.eventName} (${g.eventDate}, priorité ${g.priority}, ${distance}) : ${g.targetOutcome}`)
    }
  }

  lines.push('', 'FAITS À RETENIR :')
  if (input.rememberedFacts.length === 0) {
    lines.push('- Aucun.')
  } else {
    for (const f of input.rememberedFacts) lines.push(`- ${f}`)
  }

  const libraryBlock = buildLibraryContextBlock(input.references ?? [])
  if (libraryBlock) lines.push(libraryBlock)

  lines.push('', '=== FIN DU CONTEXTE COACH ===')
  return lines.join('\n')
}
