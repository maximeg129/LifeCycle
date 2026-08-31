import { describe, it, expect } from 'vitest'
import { computeEvidenceContentHash, computePromptVersion, PROMPT_ASSEMBLER_VERSION } from './promptVersion'

describe('computeEvidenceContentHash', () => {
  it('is deterministic — the same content always hashes the same', () => {
    expect(computeEvidenceContentHash()).toBe(computeEvidenceContentHash())
  })

  it('is a short hex string, not the full digest — compact enough to log/read', () => {
    const hash = computeEvidenceContentHash()
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('computePromptVersion', () => {
  it('embeds the assembler version, the flow id, and the content hash', () => {
    const version = computePromptVersion('dailyWorkoutRecommendation')
    expect(version).toContain(PROMPT_ASSEMBLER_VERSION)
    expect(version).toContain('dailyWorkoutRecommendation')
    expect(version).toContain(computeEvidenceContentHash())
  })

  it('differs by flow id even though the content hash is the same', () => {
    const a = computePromptVersion('rideAnalysis')
    const b = computePromptVersion('recoveryInsight')
    expect(a).not.toBe(b)
  })

  it('is stable across repeated calls for the same flow', () => {
    expect(computePromptVersion('coachChat')).toBe(computePromptVersion('coachChat'))
  })
})
