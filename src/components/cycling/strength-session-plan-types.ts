// ── Glue entre les séances type du plan (planWeekSessions) et la validation
// musculation (S05, strengthSessionValidator.ts) ───────────────────────────
//
// Retour utilisateur : "Tu dois respecter strictement les règles ci-dessous
// — une séance qui ne les respecte pas ne doit jamais être proposée comme
// séance 'complète'." Le résultat de la validation est calculé CÔTÉ CLIENT
// (use-training-plan.ts, après réception de la réponse du flow — jamais par
// le modèle lui-même, qui ne peut pas s'auto-vérifier de façon fiable) puis
// stocké à côté de chaque séance dans Firestore, pour ne jamais avoir à
// revalider à chaque affichage.

import type { MovementPattern } from '@/domain/cycling/validation/strengthSessionValidator'
import type { PlanWeek } from './training-plan-types'

/**
 * Patterns des ~2 dernières séances de musculation déjà générées dans le
 * plan, AVANT `beforeWeekNumber` — de la plus ancienne à la plus récente,
 * pour la règle hip-hinge (S05 §2 / checkHipHingePresence). Ne regarde que
 * les semaines dont les séances type ont déjà été générées (sampleSessions
 * présent) ; une semaine sans séance générée n'apporte aucun historique.
 */
export function recentStrengthSessionPatterns(weeks: PlanWeek[], beforeWeekNumber: number): MovementPattern[][] {
  const priorWeeks = [...weeks]
    .filter((w) => w.weekNumber < beforeWeekNumber && w.sampleSessions)
    .sort((a, b) => a.weekNumber - b.weekNumber)

  const sessionsPatterns: MovementPattern[][] = []
  for (const week of priorWeeks) {
    for (const session of week.sampleSessions ?? []) {
      if (session.sessionKind !== 'strength') continue
      const patterns = (session.strengthExercises ?? []).map((e) => e.pattern).filter((p): p is MovementPattern => !!p)
      sessionsPatterns.push(patterns)
    }
  }
  return sessionsPatterns.slice(-2)
}
