import { describe, it, expect } from 'vitest'
import { RULES } from './rules'
import { REFERENCES } from './references'

describe('RULES — garde-fou principal', () => {
  // C'est LE garde-fou demandé explicitement : "une règle sans refs non
  // vide et sans convention: true doit échouer... au test." Sans lui, une
  // affirmation scientifique pourrait se glisser dans le prompt du coach
  // sans jamais être vérifiée contre une source.
  it('every rule has at least one ref, unless explicitly marked convention: true', () => {
    const offenders = RULES.filter((r) => r.refs.length === 0 && r.convention !== true)
    expect(offenders.map((r) => r.id)).toEqual([])
  })

  it('never sets both a non-empty refs array and convention: true — that would hide which one actually justifies the rule', () => {
    const offenders = RULES.filter((r) => r.convention === true && r.refs.length > 0)
    expect(offenders.map((r) => r.id)).toEqual([])
  })

  it('has no duplicate rule ids', () => {
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references ids that actually exist in REFERENCES', () => {
    const knownIds = new Set(Object.keys(REFERENCES))
    for (const rule of RULES) {
      for (const ref of rule.refs) {
        expect(knownIds.has(ref), `rule "${rule.id}" cites unknown ref "${ref}"`).toBe(true)
      }
    }
  })

  it('gives every rule a non-empty statement', () => {
    for (const rule of RULES) {
      expect(rule.statement.trim(), `rule "${rule.id}"`).not.toBe('')
    }
  })

  it('covers every scope from the specification', () => {
    const scopes = new Set(RULES.map((r) => r.scope))
    expect([...scopes].sort()).toEqual(
      ['forbidden-claim', 'interpretation', 'plan-validation', 'red-flag', 'ride-analysis', 'session-arbitration'].sort()
    )
  })

  it('covers all 9 plan-validation checks (section 4)', () => {
    expect(RULES.filter((r) => r.scope === 'plan-validation')).toHaveLength(9)
  })

  it('covers all 8 forbidden claims (section 8)', () => {
    expect(RULES.filter((r) => r.scope === 'forbidden-claim')).toHaveLength(8)
  })

  it('covers all 10 non-negotiable principles (section 1)', () => {
    expect(RULES.filter((r) => r.id.startsWith('principle-'))).toHaveLength(10)
  })

  it('the 1.06-in-cycling exponent is explicitly forbidden and grounded in R12', () => {
    const rule = RULES.find((r) => r.id === 'forbidden-1-06-running-exponent-in-cycling')
    expect(rule).toBeDefined()
    expect(rule?.refs).toContain('R12')
  })
})
