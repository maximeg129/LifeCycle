import { describe, it, expect } from 'vitest'
import { carbIntakeGuidance, assessREDsRisk, REDS_RISK_SIGNALS, type REDsRiskInput } from './nutrition'

describe('carbIntakeGuidance', () => {
  it('returns the sourced 120g/h ceiling and ~1:0.8 glucose:fructose ratio (R34)', () => {
    const guidance = carbIntakeGuidance()
    expect(guidance.maxGramsPerHour).toBe(120)
    expect(guidance.glucoseFructoseRatio).toEqual([1, 0.8])
  })
})

const NO_SIGNALS: REDsRiskInput = {
  persistentEnergyDeficit: false,
  unplannedWeightLoss: false,
  stressFractureHistory: false,
  sleepOrHormonalIssues: false,
}

describe('assessREDsRisk', () => {
  it('is not flagged when no signal is present', () => {
    const result = assessREDsRisk(NO_SIGNALS)
    expect(result.flagged).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('flags on a single signal', () => {
    const result = assessREDsRisk({ ...NO_SIGNALS, persistentEnergyDeficit: true })
    expect(result.flagged).toBe(true)
    expect(result.reasons).toEqual(['Faible disponibilité énergétique répétée'])
  })

  it('flags on any of the 4 sourced signals individually', () => {
    expect(assessREDsRisk({ ...NO_SIGNALS, unplannedWeightLoss: true }).flagged).toBe(true)
    expect(assessREDsRisk({ ...NO_SIGNALS, stressFractureHistory: true }).flagged).toBe(true)
    expect(assessREDsRisk({ ...NO_SIGNALS, sleepOrHormonalIssues: true }).flagged).toBe(true)
  })

  it('lists every present signal, in the order of the red-flag-reds rule text', () => {
    const result = assessREDsRisk({
      persistentEnergyDeficit: true,
      unplannedWeightLoss: true,
      stressFractureHistory: false,
      sleepOrHormonalIssues: true,
    })
    expect(result.reasons).toEqual([
      'Faible disponibilité énergétique répétée',
      'Perte de poids non planifiée',
      'Troubles du sommeil ou hormonaux',
    ])
  })

  it('never invents a severity score — only ever flagged + a plain list of reasons', () => {
    const result = assessREDsRisk({ ...NO_SIGNALS, persistentEnergyDeficit: true })
    expect(Object.keys(result).sort()).toEqual(['flagged', 'reasons'])
  })
})

describe('REDS_RISK_SIGNALS', () => {
  it('covers exactly the 4 signals named in the red-flag-reds rule text (R35)', () => {
    expect(REDS_RISK_SIGNALS).toHaveLength(4)
    expect(REDS_RISK_SIGNALS.map((s) => s.key)).toEqual([
      'persistentEnergyDeficit',
      'unplannedWeightLoss',
      'stressFractureHistory',
      'sleepOrHormonalIssues',
    ])
  })
})
