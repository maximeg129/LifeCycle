// ── Coach context assembly — pure function, no Firebase deps ──────────────
//
// Instead of letting the LLM reconstruct context from raw logs on every call,
// this composes an explicit, human-readable text block from the structured
// Coach Memory documents plus the current load-model metrics (kJ budget,
// internal load governor, endurance index). The block is prefixed to the
// system prompt of any Claude call concerning training.
//
// ⚠️ Le bloc "BASE DE CONNAISSANCES" (sources ajoutées librement par
// l'athlète dans l'ancienne bibliothèque coach, coachLibrary Firestore) a
// été retiré ici — décision utilisateur du 31 août 2026 (docs/OPEN_QUESTIONS.md,
// Q4, réponse (c)) : coachLibrary est réorientée en lecture seule des 35
// références (evidence/references.ts), plus de CRUD utilisateur libre.
// Ces 6 flows (dailyWorkoutRecommendation, trainingPlanGeneration,
// planWeekSessions, coachChat, rideAnalysis, recoveryInsight) sont de
// toute façon déjà grounded dans RULES/REFERENCES via buildSystemPrompt
// (src/ai/coach/, PR 8) — bien plus rigoureux que le résumé libre que ce
// bloc injectait ici (une source pouvait être ajoutée sans revue, sans
// niveau de preuve, sans garantie qu'elle ne contredise pas les 35
// références). Voir coach-library-tab.tsx pour le nouvel affichage
// lecture-seule.

import { differenceInCalendarDays } from 'date-fns'
import type { GovernorStatus } from './load-types'
import type { InjuryStatus } from './coach-memory-types'
import type { KJTrendDirection } from '@/domain/cycling/metrics/kj'

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
  kjBudget: {
    realized: number
    target: number
    baseline: number
    /** Tendance 8 semaines (kj.ts, computeKJPerKgTrend) — optionnel pour rester compatible avec un appelant qui ne l'a pas encore. */
    trend?: { direction: KJTrendDirection; pctChange: number }
    /** Palier de durabilité déjà sourcé (R08/R10/R11) dépassé cette semaine — plafond de référence, jamais une cible (kj.ts, checkAgainstDurabilityCeilings). `null` sous le premier seuil, absent si non calculé par l'appelant. */
    exceedsThresholdKJPerKg?: number | null
  }
  governorStatus: GovernorStatus
  /**
   * Session-RPE/monotonie/strain (R21, load.ts) sur les 7 derniers jours —
   * même champ que use-governor.ts's `trainingLoad`, purement descriptif
   * (aucun seuil sourcé ne qualifie une monotonie/un strain d'"élevé", voir
   * Q7 docs/OPEN_QUESTIONS.md) : jamais un verdict, juste un chiffre réel de
   * plus à croiser. `null`/absent si aucune séance qualifiante récente.
   */
  trainingLoad?: { weeklySessionRPE: number; monotony: number | null; strain: number | null } | null
  enduranceIndex?: number | null
  /** Modèle puissance critique/W′ (R14, criticalPower.ts, fitCriticalPower sur les mêmes 3 records perso que l'indice d'endurance) — alternative physiologiquement fondée à privilégier côté vélo (riegel-prefer-critical-power-side-cycling). `null`/absent si non calculable (moins de 2 records). */
  criticalPower?: { cpWatts: number; wPrimeKJ: number } | null
}

function governorStatusLabel(status: GovernorStatus): string {
  switch (status) {
    case 'vert': return '🟢 Favorable (le budget peut augmenter)'
    case 'orange': return '🟠 Stable (ne pas augmenter)'
    case 'rouge': return '🔴 Dégradé (stabiliser ou réduire la charge)'
    default: return '⚪ Données insuffisantes pour statuer'
  }
}

function kjTrendLabel(direction: KJTrendDirection): string {
  switch (direction) {
    case 'up': return 'en hausse'
    case 'down': return 'en baisse'
    default: return 'stable'
  }
}

/** Composes the structured coach-memory context block, in French, ready to prefix a system prompt. */
export function buildCoachContext(input: CoachContextInput): string {
  const lines: string[] = ['=== CONTEXTE COACH (mémoire structurée) ===']

  lines.push('', `AUJOURD'HUI : ${input.today}`)

  lines.push('', "CHARGE D'ENTRAÎNEMENT ACTUELLE :")
  // ⚠️ Corrigé au passage : ce champ est en kJ/kg depuis kj.ts (PR 11c,
  // "jamais des kJ bruts", règle kj-budget-unit-is-kj-per-kg-weighted) mais
  // le texte du prompt disait encore "kJ" — un vrai athlète peut brûler
  // plusieurs milliers de kJ bruts sur une semaine, donc l'étiquette
  // trompait potentiellement le raisonnement du modèle sur l'ordre de
  // grandeur réel (quelques dizaines de kJ/kg, pas des centaines/milliers).
  lines.push(`- Budget kJ/kg de la semaine : ${input.kjBudget.realized} kJ/kg réalisés / ${input.kjBudget.target || '?'} kJ/kg cible (base 8 semaines : ${input.kjBudget.baseline} kJ/kg)`)
  if (input.kjBudget.trend) {
    const t = input.kjBudget.trend
    lines.push(`- Tendance kJ/kg (8 semaines) : ${kjTrendLabel(t.direction)} (${t.pctChange > 0 ? '+' : ''}${t.pctChange}%)`)
  }
  if (input.kjBudget.exceedsThresholdKJPerKg != null) {
    lines.push(`- Palier de durabilité dépassé cette semaine : ${input.kjBudget.exceedsThresholdKJPerKg} kJ/kg (repère de référence R08/R10/R11 — jamais une cible, voir kj-budget-thresholds-are-ceilings-not-targets)`)
  }
  lines.push(`- Gouverneur de charge interne : ${governorStatusLabel(input.governorStatus)}`)
  if (input.trainingLoad) {
    const tl = input.trainingLoad
    const parts = [`session-RPE hebdo ${tl.weeklySessionRPE}`]
    if (tl.monotony != null) parts.push(`monotonie ${tl.monotony.toFixed(2)}`)
    if (tl.strain != null) parts.push(`strain ${tl.strain}`)
    lines.push(`- Charge d'entraînement 7j (R21) : ${parts.join(', ')} — chiffres descriptifs, aucun seuil sourcé ne qualifie une valeur d'"élevée" (voir Q7)`)
  }
  if (input.enduranceIndex != null) {
    lines.push(`- Indice d'endurance (Riegel) : ${input.enduranceIndex.toFixed(2)}`)
  }
  if (input.criticalPower) {
    lines.push(`- Puissance critique (CP/W′, R14) : ${Math.round(input.criticalPower.cpWatts)} W, réserve W′ ${input.criticalPower.wPrimeKJ.toFixed(1)} kJ`)
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

  lines.push('', '=== FIN DU CONTEXTE COACH ===')
  return lines.join('\n')
}
