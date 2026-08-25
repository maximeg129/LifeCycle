// ── Coach context assembly — pure function, no Firebase deps ──────────────
//
// Instead of letting the LLM reconstruct context from raw logs on every call,
// this composes an explicit, human-readable text block from the structured
// Coach Memory documents plus the current load-model metrics (kJ budget,
// internal load governor, endurance index). The block is prefixed to the
// system prompt of any Claude call concerning training.

import type { GovernorStatus } from './load-types'
import type { InjuryStatus } from './coach-memory-types'

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
  injuries: CoachContextInjury[]
  lifestyle: CoachContextLifestyle | null
  goals: CoachContextGoal[]
  rememberedFacts: string[]
  kjBudget: { realized: number; target: number; baseline: number }
  governorStatus: GovernorStatus
  enduranceIndex?: number | null
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
    const sorted = [...input.goals].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    for (const g of sorted) {
      lines.push(`- ${g.eventName} (${g.eventDate}, priorité ${g.priority}) : ${g.targetOutcome}`)
    }
  }

  lines.push('', 'FAITS À RETENIR :')
  if (input.rememberedFacts.length === 0) {
    lines.push('- Aucun.')
  } else {
    for (const f of input.rememberedFacts) lines.push(`- ${f}`)
  }

  lines.push('', '=== FIN DU CONTEXTE COACH ===')
  return lines.join('\n')
}
