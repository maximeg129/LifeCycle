import { describe, it, expect } from 'vitest'
import { planKmDeltaUpdate } from './km-sync'

describe('planKmDeltaUpdate', () => {
  it('picks the mounted chain when the bike has rotation chains', () => {
    const chains = [
      { id: 'a', status: 'stockage' },
      { id: 'b', status: 'montee' },
    ]
    const plan = planKmDeltaUpdate([], chains)
    expect(plan.chainToUpdate).toEqual({ id: 'b', status: 'montee' })
  })

  it('has no chain to update when none is mounted', () => {
    const chains = [{ id: 'a', status: 'stockage' }, { id: 'b', status: 'retiree' }]
    expect(planKmDeltaUpdate([], chains).chainToUpdate).toBeNull()
  })

  it('has no chain to update when the bike has no rotation chains at all', () => {
    expect(planKmDeltaUpdate([], []).chainToUpdate).toBeNull()
  })

  it('excludes a generic chain component when a dedicated rotation chain covers this bike', () => {
    const components = [
      { id: 'comp-chain', category: 'chain' },
      { id: 'comp-cassette', category: 'cassette' },
    ]
    const chains = [{ id: 'chain-1', status: 'montee' }]
    const plan = planKmDeltaUpdate(components, chains)
    expect(plan.componentsToUpdate.map((c) => c.id)).toEqual(['comp-cassette'])
  })

  it('keeps a generic chain component when the bike has no rotation chains', () => {
    const components = [
      { id: 'comp-chain', category: 'chain' },
      { id: 'comp-cassette', category: 'cassette' },
    ]
    const plan = planKmDeltaUpdate(components, [])
    expect(plan.componentsToUpdate.map((c) => c.id)).toEqual(['comp-chain', 'comp-cassette'])
  })

  it('never drops a mounted chain update just because the bike also has ordinary components', () => {
    // Regression: the manual-km-edit path used to update components but silently
    // skip the mounted chain entirely — this is the exact case that should catch it.
    const components = [{ id: 'comp-cassette', category: 'cassette' }]
    const chains = [{ id: 'chain-1', status: 'montee' }]
    const plan = planKmDeltaUpdate(components, chains)
    expect(plan.chainToUpdate).not.toBeNull()
    expect(plan.componentsToUpdate).toHaveLength(1)
  })
})
