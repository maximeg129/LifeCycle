// ── Vérification hors ligne du pipeline "séances de musculation" ──────────
//
// Retour utilisateur : "Vérifie que les nouvelles séances muscu se génèrent
// bien dans l'app." Cet environnement n'a pas de ANTHROPIC_API_KEY
// configurée (voir apphosting.yaml — le secret n'existe qu'en production),
// donc un vrai appel au modèle n'est pas exécutable ici. Ce test vérifie
// tout ce qui EST vérifiable sans appel réseau : (1) qu'une réponse
// plausible du modèle, dans la forme exacte attendue par le prompt de
// plan-week-sessions-flow.ts, satisfait bien PlanWeekSessionsOutput
// (le type inféré du VRAI schéma Zod du flow — tsc échoue si le fixture
// et le schéma divergent) ; (2) que cette réponse, une fois passée dans
// validateStrengthSession() (le même chemin que use-training-plan.ts),
// est jugée conforme pour une séance bien formée et correctement
// signalée pour une séance qui enfreint la grille S05.

import { describe, it, expect } from 'vitest'
import type { PlanWeekSessionsOutput, PlanWeekSession } from './plan-week-sessions-flow'
import { validateStrengthSession, type MovementPattern } from '@/domain/cycling/validation/strengthSessionValidator'

/** Réponse plausible du modèle pour une semaine "build" avec musculation demandée — forme exacte que le prompt de plan-week-sessions-flow.ts demande (voir son exemple JSON). */
const plausibleModelOutput: PlanWeekSessionsOutput = {
  verdict: 'ok',
  summary: "Semaine de développement équilibrée entre vélo et force, avec une séance de musculation complète couvrant les patterns clés.",
  recommendation: 'Priorise la sortie seuil si le temps manque cette semaine.',
  reasons: [],
  uncertainty: "FTP fournie, aucune incertitude notable sur cette semaine.",
  sessions: [
    {
      sessionKind: 'cycling',
      title: 'Endurance 90min',
      sportType: 'Ride',
      durationMinutes: 90,
      intensityLabel: 'Endurance',
      rationale: 'Volume de base pour la phase build.',
      structuredWorkout: '- 90m 60-70% Endurance',
      fueling: {
        neededOnBike: true,
        carbGramsPerHourMin: 30,
        carbGramsPerHourMax: 60,
        hydrationNote: null,
        rationale: '90 minutes à intensité modérée — fourchette standard 1h-2h30 (S03/S04).',
      },
    },
    {
      sessionKind: 'strength',
      title: 'Force bas du corps',
      sportType: 'WeightTraining',
      durationMinutes: 45,
      intensityLabel: 'Force',
      rationale: 'Séance principale de la semaine — travail de force lourd complémentaire au vélo.',
      sessionType: 'principale',
      strengthPhase: 'force-max',
      strengthExercises: [
        { name: 'Squat', pattern: 'bilateral-heavy', sets: 4, reps: '4-6', repsMin: 4, repsMax: 6, pct1RMMin: 85, pct1RMMax: 90, loadGuidance: 'Charge lourde (RPE 8-9)', restSeconds: 240 },
        { name: 'Soulevé de terre roumain', pattern: 'hip-hinge', sets: 4, reps: '4-6', repsMin: 4, repsMax: 6, pct1RMMin: 85, pct1RMMax: 90, loadGuidance: 'Charge lourde (RPE 8)', restSeconds: 240 },
        { name: 'Fentes bulgares', pattern: 'unilateral', sets: 3, reps: '5-6', repsMin: 5, repsMax: 6, pct1RMMin: 80, pct1RMMax: 88, loadGuidance: 'Charge lourde par jambe', restSeconds: 180 },
        { name: 'Planche frontale', pattern: 'anti-extension', sets: 3, reps: '30-45s', repsMin: 30, repsMax: 45, pct1RMMin: null, pct1RMMax: null, loadGuidance: 'Poids du corps', restSeconds: 60 },
        { name: 'Pallof press', pattern: 'anti-rotation-lateral', sets: 3, reps: '8-10', repsMin: 8, repsMax: 10, pct1RMMin: null, pct1RMMax: null, loadGuidance: 'Charge modérée', restSeconds: 60 },
      ],
    },
  ],
} satisfies PlanWeekSessionsOutput

describe('plan-week-sessions-flow — realistic strength session fixture', () => {
  it('a plausible model response for a strength-enabled week satisfies the real PlanWeekSessionsOutput type', () => {
    // La vérification a déjà eu lieu à la compilation (satisfies ci-dessus)
    // — ce test confirme aussi que la valeur existe bien à l'exécution et
    // qu'elle contient une séance de chaque sessionKind.
    expect(plausibleModelOutput.sessions).toHaveLength(2)
    expect(plausibleModelOutput.sessions.map((s) => s.sessionKind)).toEqual(['cycling', 'strength'])
  })

  it('a well-formed "principale" strength session validates as fully compliant with S05', () => {
    const strengthSession = plausibleModelOutput.sessions.find((s) => s.sessionKind === 'strength') as PlanWeekSession & { strengthPhase: 'force-max' }
    const summary = validateStrengthSession({
      session: {
        sessionType: strengthSession.sessionType ?? 'principale',
        strengthPhase: strengthSession.strengthPhase,
        durationMinutes: strengthSession.durationMinutes,
        exercises: strengthSession.strengthExercises ?? [],
      },
      previousSessionsPatterns: [],
      weeklyCyclingHours: 8,
      cyclingPhase: 'build',
      strengthSessionsThisWeek: 1,
      hoursBeforeNextKeySession: null,
    })
    expect(summary.overallVerdict).toBe('ok')
    expect(summary.isMaintenanceOnly).toBe(false)
    expect(summary.results.every((r) => r.verdict === 'ok' || r.verdict === 'insufficient_data')).toBe(true)
  })

  it('the same pipeline correctly BLOCKS a non-compliant "principale" session (missing bilateral-heavy)', () => {
    const nonCompliant: PlanWeekSession = {
      ...plausibleModelOutput.sessions[1],
      strengthExercises: (plausibleModelOutput.sessions[1].strengthExercises ?? []).filter((e) => e.pattern !== ('bilateral-heavy' as MovementPattern)),
    }
    const summary = validateStrengthSession({
      session: {
        sessionType: 'principale',
        strengthPhase: 'force-max',
        durationMinutes: nonCompliant.durationMinutes,
        exercises: nonCompliant.strengthExercises ?? [],
      },
      previousSessionsPatterns: [],
      weeklyCyclingHours: 8,
      cyclingPhase: 'build',
      strengthSessionsThisWeek: 1,
      hoursBeforeNextKeySession: null,
    })
    expect(summary.overallVerdict).toBe('blocked')
    expect(summary.results.find((r) => r.checkId === 'strength-check-1-pattern-coverage')?.verdict).toBe('block')
  })

  it('a "cycling" session never carries strength-only fields (sessionType/strengthPhase/strengthExercises)', () => {
    const cyclingSession = plausibleModelOutput.sessions.find((s) => s.sessionKind === 'cycling')!
    expect(cyclingSession.sessionType).toBeUndefined()
    expect(cyclingSession.strengthPhase).toBeUndefined()
    expect(cyclingSession.strengthExercises).toBeUndefined()
  })
})
