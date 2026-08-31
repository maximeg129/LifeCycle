import { describe, it, expect } from 'vitest'
import { buildCoachContext, type CoachContextInput } from './coach-context'

const baseInput: CoachContextInput = {
  today: '2026-08-30',
  injuries: [],
  lifestyle: null,
  goals: [],
  rememberedFacts: [],
  kjBudget: { realized: 0, target: 0, baseline: 0 },
  governorStatus: 'insufficient_data',
}

describe('buildCoachContext', () => {
  it("includes today's date", () => {
    expect(buildCoachContext(baseInput)).toContain("AUJOURD'HUI : 2026-08-30")
  })

  it('annotates each goal with how many days away it is', () => {
    const text = buildCoachContext({
      ...baseInput,
      goals: [
        { eventName: 'La Marmotte', eventDate: '2026-09-09', targetOutcome: 'Sub 8h', priority: 1 },
        { eventName: 'Objectif passé', eventDate: '2026-08-20', targetOutcome: 'Fait', priority: 2 },
        { eventName: "Objectif aujourd'hui", eventDate: '2026-08-30', targetOutcome: 'Fait', priority: 3 },
      ],
    })
    expect(text).toContain('La Marmotte (2026-09-09, priorité 1, dans 10 jours)')
    expect(text).toContain('Objectif passé (2026-08-20, priorité 2, il y a 10 jours)')
    expect(text).toContain("Objectif aujourd'hui (2026-08-30, priorité 3, aujourd'hui)")
  })

  it('includes the kJ budget and governor status', () => {
    const text = buildCoachContext({
      ...baseInput,
      kjBudget: { realized: 450, target: 1200, baseline: 1100 },
      governorStatus: 'vert',
    })
    expect(text).toContain('450 kJ réalisés / 1200 kJ cible')
    expect(text).toContain('base 8 semaines : 1100 kJ')
    expect(text).toContain('🟢 Favorable')
  })

  it('lists active and resolved injuries with a correct active count', () => {
    const text = buildCoachContext({
      ...baseInput,
      injuries: [
        { bodyRegion: 'Genou droit', severity: 3, status: 'active', startDate: '2026-06-01', description: 'Douleur tendon rotulien', physioInstructions: 'Renfo excentrique 2x/sem' },
        { bodyRegion: 'Épaule gauche', severity: 1, status: 'resolved', startDate: '2025-11-01', description: 'Tendinite légère', physioInstructions: '' },
      ],
    })
    expect(text).toContain('BLESSURES (1 active)')
    expect(text).toContain('Genou droit (sévérité 3/5, active, depuis 2026-06-01) : Douleur tendon rotulien — Consignes kiné : Renfo excentrique 2x/sem')
    expect(text).toContain('Épaule gauche (sévérité 1/5, résolue, depuis 2025-11-01) : Tendinite légère')
  })

  it('reports no injuries plainly when the list is empty', () => {
    const text = buildCoachContext(baseInput)
    expect(text).toContain('BLESSURES (0 active)')
    expect(text).toContain('Aucune blessure enregistrée.')
  })

  it('sorts goals by event date', () => {
    const text = buildCoachContext({
      ...baseInput,
      goals: [
        { eventName: 'Marathon des Sables', eventDate: '2027-04-01', targetOutcome: 'Finir', priority: 2 },
        { eventName: 'La Marmotte', eventDate: '2026-07-04', targetOutcome: 'Sub 8h', priority: 1 },
      ],
    })
    const marmotteIdx = text.indexOf('La Marmotte')
    const sablesIdx = text.indexOf('Marathon des Sables')
    expect(marmotteIdx).toBeGreaterThan(-1)
    expect(marmotteIdx).toBeLessThan(sablesIdx)
  })

  it('includes remembered facts verbatim', () => {
    const text = buildCoachContext({ ...baseInput, rememberedFacts: ["Préfère les sorties le matin", 'Allergique aux gels à la caféine'] })
    expect(text).toContain('- Préfère les sorties le matin')
    expect(text).toContain('- Allergique aux gels à la caféine')
  })

  it('includes the endurance index only when provided', () => {
    expect(buildCoachContext(baseInput)).not.toContain('Indice d\'endurance')
    expect(buildCoachContext({ ...baseInput, enduranceIndex: 0.91 })).toContain("Indice d'endurance (Riegel) : 0.91")
  })

  // Le bloc "BASE DE CONNAISSANCES" (coachLibrary Firestore libre) a été
  // retiré — Q4 (docs/OPEN_QUESTIONS.md), réponse (c) : coachLibrary est
  // réorientée en lecture seule des 35 références, ces flows sont déjà
  // grounded via buildSystemPrompt (src/ai/coach/, PR 8). Garde-fou de
  // non-régression : jamais réintroduit sans y repenser.
  it('never emits a "BASE DE CONNAISSANCES" section — retired in favor of buildSystemPrompt grounding (PR 8)', () => {
    expect(buildCoachContext(baseInput)).not.toContain('BASE DE CONNAISSANCES')
  })
})
