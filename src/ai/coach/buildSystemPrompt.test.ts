import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, selectRulesForFlow, type CoachFlowId } from './buildSystemPrompt'
import { RULES } from '@/domain/cycling/evidence/rules'

const ALL_FLOW_IDS: CoachFlowId[] = [
  'dailyWorkoutRecommendation',
  'trainingPlanGeneration',
  'trainingPlanRecalibration',
  'planWeekSessions',
  'coachChat',
  'rideAnalysis',
  'recoveryInsight',
]

describe('selectRulesForFlow', () => {
  it('always includes every principle-*/forbidden-*/red-flag-* rule, for every flow', () => {
    const universalIds = RULES.filter((r) => /^(principle-|forbidden-|red-flag-)/.test(r.id)).map((r) => r.id)
    for (const flowId of ALL_FLOW_IDS) {
      const selectedIds = new Set(selectRulesForFlow(flowId).map((r) => r.id))
      for (const id of universalIds) expect(selectedIds.has(id), `${flowId} should include universal rule ${id}`).toBe(true)
    }
  })

  it('always includes interpretation-scope rules, for every flow', () => {
    for (const flowId of ALL_FLOW_IDS) {
      const selected = selectRulesForFlow(flowId)
      expect(selected.some((r) => r.scope === 'interpretation')).toBe(true)
    }
  })

  it('gives dailyWorkoutRecommendation session-arbitration rules but not plan-validation ones', () => {
    const scopes = new Set(selectRulesForFlow('dailyWorkoutRecommendation').map((r) => r.scope))
    expect(scopes.has('session-arbitration')).toBe(true)
    expect(scopes.has('plan-validation')).toBe(false)
  })

  it('gives trainingPlanGeneration, trainingPlanRecalibration and planWeekSessions plan-validation rules but not session-arbitration ones', () => {
    for (const flowId of ['trainingPlanGeneration', 'trainingPlanRecalibration', 'planWeekSessions'] as const) {
      const scopes = new Set(selectRulesForFlow(flowId).map((r) => r.scope))
      expect(scopes.has('plan-validation')).toBe(true)
      expect(scopes.has('session-arbitration')).toBe(false)
    }
  })

  it('gives rideAnalysis ride-analysis rules but not plan-validation ones', () => {
    const scopes = new Set(selectRulesForFlow('rideAnalysis').map((r) => r.scope))
    expect(scopes.has('ride-analysis')).toBe(true)
    expect(scopes.has('plan-validation')).toBe(false)
  })

  it('gives coachChat every scope — the broadest flow, conversational and unpredictable in topic', () => {
    const scopes = new Set(selectRulesForFlow('coachChat').map((r) => r.scope))
    for (const s of ['interpretation', 'plan-validation', 'session-arbitration', 'ride-analysis', 'red-flag', 'forbidden-claim'] as const) {
      expect(scopes.has(s), `coachChat should include scope ${s}`).toBe(true)
    }
  })

  it('gives recoveryInsight no extra scope beyond the universal core + interpretation', () => {
    const scopes = new Set(selectRulesForFlow('recoveryInsight').map((r) => r.scope))
    expect(scopes.has('plan-validation')).toBe(false)
    expect(scopes.has('session-arbitration')).toBe(false)
    expect(scopes.has('ride-analysis')).toBe(false)
  })
})

describe('buildSystemPrompt', () => {
  it('embeds a PROMPT_VERSION header', () => {
    expect(buildSystemPrompt('recoveryInsight')).toMatch(/\[PROMPT_VERSION: .+\]/)
  })

  it('cites every rule id it includes, and only refs that exist in REFERENCES', () => {
    const prompt = buildSystemPrompt('rideAnalysis')
    for (const rule of selectRulesForFlow('rideAnalysis')) {
      expect(prompt).toContain(rule.id)
    }
  })

  it('never contradicts the "never invent a rule" principle — every ref cited in the appendix corresponds to a rule actually included', () => {
    const flowId: CoachFlowId = 'trainingPlanGeneration'
    const prompt = buildSystemPrompt(flowId)
    const rules = selectRulesForFlow(flowId)
    const citedRefs = new Set(rules.flatMap((r) => r.refs))
    for (const ref of citedRefs) expect(prompt).toContain(ref)
  })

  // Garde-fou CI n°5 demandé explicitement : "snapshot du prompt système —
  // tout changement doit être explicite dans une PR, jamais accidentel."
  // Un changement de RULES/REFERENCES (donc du hash de version) OU de la
  // logique d'assemblage fera échouer ce test tant que le snapshot n'est
  // pas régénéré consciemment (`vitest -u`) — jamais un changement silencieux.
  it.each(ALL_FLOW_IDS)('matches its committed snapshot for flow "%s"', (flowId) => {
    expect(buildSystemPrompt(flowId)).toMatchSnapshot()
  })
})
