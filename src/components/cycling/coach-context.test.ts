import { describe, it, expect } from 'vitest'
import { buildCoachContext, type CoachContextInput } from './coach-context'

const baseInput: CoachContextInput = {
  injuries: [],
  lifestyle: null,
  goals: [],
  rememberedFacts: [],
  kjBudget: { realized: 0, target: 0, baseline: 0 },
  governorStatus: 'insufficient_data',
}

describe('buildCoachContext', () => {
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
})
