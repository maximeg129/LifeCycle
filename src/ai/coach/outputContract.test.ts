import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { CoachOutputContractSchema, withCoachOutputContract, describeCoachOutputContract } from './outputContract'

const VALID_CONTRACT_FIELDS = {
  verdict: 'ok' as const,
  summary: 'Tout va bien.',
  recommendation: 'Continuer comme prévu.',
  reasons: [{ rule: 'principle-1-external-vs-internal-load', refs: ['R05'], detail: 'Décision basée sur la charge interne.' }],
  uncertainty: "Le sommeil de la nuit dernière n'était pas renseigné.",
}

describe('CoachOutputContractSchema', () => {
  it('accepts a fully-formed contract response', () => {
    expect(CoachOutputContractSchema.safeParse(VALID_CONTRACT_FIELDS).success).toBe(true)
  })

  it('rejects a response missing uncertainty — the guardrail explicitly requested', () => {
    const { uncertainty: _uncertainty, ...withoutUncertainty } = VALID_CONTRACT_FIELDS
    expect(CoachOutputContractSchema.safeParse(withoutUncertainty).success).toBe(false)
  })

  it('rejects an empty-string uncertainty — never silently accepted as "nothing to report"', () => {
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, uncertainty: '' }).success).toBe(false)
  })

  it('rejects a response missing verdict', () => {
    const { verdict: _verdict, ...withoutVerdict } = VALID_CONTRACT_FIELDS
    expect(CoachOutputContractSchema.safeParse(withoutVerdict).success).toBe(false)
  })

  it('rejects a verdict outside the ok/warn/block enum', () => {
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, verdict: 'maybe' }).success).toBe(false)
  })

  it('rejects a response missing reasons', () => {
    const { reasons: _reasons, ...withoutReasons } = VALID_CONTRACT_FIELDS
    expect(CoachOutputContractSchema.safeParse(withoutReasons).success).toBe(false)
  })

  it('accepts an empty reasons array (documented as the rare case, not forbidden)', () => {
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, reasons: [] }).success).toBe(true)
  })

  it('rejects a reason missing its rule id', () => {
    const badReasons = [{ refs: ['R05'], detail: 'x' }]
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, reasons: badReasons }).success).toBe(false)
  })

  it('rejects empty summary or recommendation', () => {
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, summary: '' }).success).toBe(false)
    expect(CoachOutputContractSchema.safeParse({ ...VALID_CONTRACT_FIELDS, recommendation: '' }).success).toBe(false)
  })
})

describe('withCoachOutputContract', () => {
  const FlowSchema = withCoachOutputContract({
    title: z.string(),
    durationMinutes: z.number(),
  })

  it('requires both the flow-specific fields AND the full contract', () => {
    expect(FlowSchema.safeParse({ ...VALID_CONTRACT_FIELDS, title: 'Endurance 90min', durationMinutes: 90 }).success).toBe(true)
  })

  it('rejects a response with the flow-specific fields but missing uncertainty', () => {
    const { uncertainty: _uncertainty, ...rest } = VALID_CONTRACT_FIELDS
    expect(FlowSchema.safeParse({ ...rest, title: 'Endurance 90min', durationMinutes: 90 }).success).toBe(false)
  })

  it('rejects a response with the full contract but missing a flow-specific field', () => {
    expect(FlowSchema.safeParse({ ...VALID_CONTRACT_FIELDS, title: 'Endurance 90min' }).success).toBe(false)
  })

  it('lets a flow-specific field override a contract field (e.g. a more specific summary/recommendation) while keeping it required', () => {
    const OverridingSchema = withCoachOutputContract({
      summary: z.string().min(1).describe('Custom description for this flow'),
    })
    expect(OverridingSchema.safeParse({ ...VALID_CONTRACT_FIELDS, summary: 'still required' }).success).toBe(true)
    expect(OverridingSchema.safeParse({ ...VALID_CONTRACT_FIELDS, summary: '' }).success).toBe(false)
  })
})

describe('describeCoachOutputContract', () => {
  it('mentions all 5 mandatory fields by name', () => {
    const text = describeCoachOutputContract()
    for (const field of ['verdict', 'summary', 'recommendation', 'reasons', 'uncertainty']) {
      expect(text).toContain(field)
    }
  })

  it('mentions the ok/warn/block verdict values', () => {
    const text = describeCoachOutputContract()
    expect(text).toMatch(/ok/)
    expect(text).toMatch(/warn/)
    expect(text).toMatch(/block/)
  })
})
