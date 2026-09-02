import { describe, it, expect } from 'vitest'
import { buildPlanAttentionItems, attentionOverallSeverity } from './plan-attention-types'

describe('buildPlanAttentionItems', () => {
  it('returns an empty list when there is nothing to signal', () => {
    expect(buildPlanAttentionItems({ verdict: 'ok', warnings: [] }, null)).toEqual([])
  })

  it('includes a warn item from the verdict, using recommendation as its text', () => {
    const items = buildPlanAttentionItems({ verdict: 'warn', recommendation: 'Réduisez le volume cette semaine.', warnings: [] }, null)
    expect(items).toEqual([{ severity: 'warn', text: 'Réduisez le volume cette semaine.' }])
  })

  it('includes a block item from the verdict', () => {
    const items = buildPlanAttentionItems({ verdict: 'block', recommendation: 'Repos complet requis.', warnings: [] }, null)
    expect(items).toEqual([{ severity: 'block', text: 'Repos complet requis.' }])
  })

  it('excludes an ok verdict even if a recommendation is present', () => {
    const items = buildPlanAttentionItems({ verdict: 'ok', recommendation: 'Tout va bien.', warnings: [] }, null)
    expect(items).toEqual([])
  })

  it('excludes a non-ok verdict without a recommendation string', () => {
    const items = buildPlanAttentionItems({ verdict: 'warn', warnings: [] }, null)
    expect(items).toEqual([])
  })

  it('adds one warn item per warnings[] string, filtering out empty ones', () => {
    const items = buildPlanAttentionItems({ verdict: 'ok', warnings: ['Déficit kJ détecté', '', 'Sommeil insuffisant'] }, null)
    expect(items).toEqual([
      { severity: 'warn', text: 'Déficit kJ détecté' },
      { severity: 'warn', text: 'Sommeil insuffisant' },
    ])
  })

  it('includes the load progression check when warn, with its rule citation', () => {
    const items = buildPlanAttentionItems({ verdict: 'ok', warnings: [] }, { verdict: 'warn', detail: 'Charge croissante sans semaine de récupération.' })
    expect(items).toEqual([
      { severity: 'warn', text: 'Charge croissante sans semaine de récupération.', ruleIds: ['plan-check-8-load-progression'] },
    ])
  })

  it('includes the load progression check when block, with its rule citation', () => {
    const items = buildPlanAttentionItems({ verdict: 'ok', warnings: [] }, { verdict: 'block', detail: 'Surcharge critique.' })
    expect(items).toEqual([
      { severity: 'block', text: 'Surcharge critique.', ruleIds: ['plan-check-8-load-progression'] },
    ])
  })

  it('excludes the load progression check when ok or insufficient_data', () => {
    expect(buildPlanAttentionItems({ verdict: 'ok', warnings: [] }, { verdict: 'ok', detail: 'RAS' })).toEqual([])
    expect(buildPlanAttentionItems({ verdict: 'ok', warnings: [] }, { verdict: 'insufficient_data', detail: 'Pas assez de semaines' })).toEqual([])
  })

  it('combines all three sources, in verdict → warnings → load-progression order', () => {
    const items = buildPlanAttentionItems(
      { verdict: 'warn', recommendation: 'Ajustez le volume.', warnings: ['Déficit kJ détecté'] },
      { verdict: 'warn', detail: 'Charge croissante sans semaine de récupération.' }
    )
    expect(items.map((i) => i.text)).toEqual([
      'Ajustez le volume.',
      'Déficit kJ détecté',
      'Charge croissante sans semaine de récupération.',
    ])
  })
})

describe('attentionOverallSeverity', () => {
  it('returns null for an empty list', () => {
    expect(attentionOverallSeverity([])).toBeNull()
  })

  it('returns warn when every item is warn', () => {
    expect(attentionOverallSeverity([{ severity: 'warn', text: 'a' }, { severity: 'warn', text: 'b' }])).toBe('warn')
  })

  it('returns block when at least one item is block, regardless of order', () => {
    expect(attentionOverallSeverity([{ severity: 'warn', text: 'a' }, { severity: 'block', text: 'b' }])).toBe('block')
  })
})
