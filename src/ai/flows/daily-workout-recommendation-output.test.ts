// ── Vérification hors ligne du pipeline "Proposition du jour ajuste le plan" ─
//
// Retour utilisateur : "le plan d'entrainement ne devrais t il pas etre
// figé avec les seances par jour ?" — dailyWorkoutRecommendation reçoit
// désormais un plannedSession optionnel et doit renvoyer adjustedFromPlan/
// planAdjustmentNote. Cet environnement n'a pas de ANTHROPIC_API_KEY (voir
// apphosting.yaml), donc un vrai appel au modèle n'est pas exécutable ici
// — même technique que plan-week-sessions-output.test.ts : une réponse
// plausible du modèle, dans la forme exacte attendue par le prompt, doit
// satisfaire DailyWorkoutRecommendationOutput (le type inféré du VRAI
// schéma Zod du flow — tsc échoue si le fixture et le schéma divergent).

import { describe, it, expect } from 'vitest'
import type { DailyWorkoutRecommendationOutput } from './daily-workout-recommendation-flow'

const baseFields = {
  verdict: 'ok' as const,
  summary: 'Séance ajustée depuis le plan compte tenu du temps disponible.',
  recommendation: 'Fais la séance proposée : Seuil 4x8min',
  reasons: [],
  uncertainty: 'Aucune incertitude notable.',
  windAdvice: null,
  predictedWeather: null,
  weatherAlert: null,
  fueling: {
    neededOnBike: false,
    carbGramsPerHourMin: null,
    carbGramsPerHourMax: null,
    hydrationNote: null,
    rationale: 'Moins de 60 minutes à intensité modérée — pas de bénéfice démontré.',
  },
}

describe('dailyWorkoutRecommendation — adjusted-from-plan output shape', () => {
  it('a plausible adjusted response satisfies the real DailyWorkoutRecommendationOutput type', () => {
    const adjusted: DailyWorkoutRecommendationOutput = {
      ...baseFields,
      title: 'Seuil 4x8min (raccourci)',
      sportType: 'Ride',
      durationMinutes: 60,
      intensityLabel: 'Seuil',
      rationale: 'Le temps disponible est plus court que prévu — le nombre de répétitions est réduit tout en gardant le même type de séance.',
      structuredWorkout: 'Échauffement\n- 10m 60% Endurance\nSeuil 3x\n- 8m 95% Seuil\n- 3m 50% Récupération\nRetour au calme\n- 5m 55% Récupération',
      warnings: [],
      adjustedFromPlan: true,
      planAdjustmentNote: 'Durée réduite de 90 à 60min, temps disponible plus court.',
    } satisfies DailyWorkoutRecommendationOutput

    expect(adjusted.adjustedFromPlan).toBe(true)
    expect(adjusted.planAdjustmentNote).toBeTruthy()
  })

  it('a plausible freely-generated response (no plan session today) also satisfies the type, with adjustedFromPlan false and a null note', () => {
    const free: DailyWorkoutRecommendationOutput = {
      ...baseFields,
      title: 'Endurance 90min',
      sportType: 'Ride',
      durationMinutes: 90,
      intensityLabel: 'Endurance',
      rationale: "Aucune séance planifiée aujourd'hui — proposition libre adaptée à la forme du jour.",
      structuredWorkout: '- 90m 65% Endurance',
      warnings: [],
      adjustedFromPlan: false,
      planAdjustmentNote: null,
    } satisfies DailyWorkoutRecommendationOutput

    expect(free.adjustedFromPlan).toBe(false)
    expect(free.planAdjustmentNote).toBeNull()
  })

  it('an unchanged adjustment (session kept as-is) still satisfies the type with a "no change" note', () => {
    const unchanged: DailyWorkoutRecommendationOutput = {
      ...baseFields,
      title: 'Endurance 90min',
      sportType: 'Ride',
      durationMinutes: 90,
      intensityLabel: 'Endurance',
      rationale: 'La forme du jour et le temps disponible correspondent à la séance prévue par le plan — aucun changement nécessaire.',
      structuredWorkout: '- 90m 65% Endurance',
      warnings: [],
      adjustedFromPlan: true,
      planAdjustmentNote: 'Aucun ajustement nécessaire.',
    } satisfies DailyWorkoutRecommendationOutput

    expect(unchanged.adjustedFromPlan).toBe(true)
    expect(unchanged.planAdjustmentNote).toBe('Aucun ajustement nécessaire.')
  })
})
