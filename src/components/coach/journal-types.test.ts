import { describe, it, expect } from 'vitest'
import { weekGroupKey, groupByWeek, weekGroupLabel } from './journal-types'

describe('weekGroupKey', () => {
  it('is unknown for an empty date', () => {
    expect(weekGroupKey('')).toBe('unknown')
  })
  it('keys by the Monday of the calendar week', () => {
    // 2024-01-10 is a Wednesday; its week starts Monday 2024-01-08
    expect(weekGroupKey('2024-01-10')).toBe('2024-01-08')
  })
  it('is unknown for an unparseable date', () => {
    expect(weekGroupKey('not-a-date')).toBe('unknown')
  })
})

describe('groupByWeek', () => {
  it('groups consecutive same-week entries together', () => {
    const entries = [
      { date: '2024-01-10', id: 'a' }, // week of 2024-01-08
      { date: '2024-01-09', id: 'b' }, // same week
      { date: '2024-01-02', id: 'c' }, // week of 2024-01-01
    ]
    const groups = groupByWeek(entries)
    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('2024-01-08')
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(groups[1].key).toBe('2024-01-01')
    expect(groups[1].entries.map((e) => e.id)).toEqual(['c'])
  })
  it('returns no groups for an empty list', () => {
    expect(groupByWeek([])).toEqual([])
  })
  it('starts a new group when the same week reappears non-consecutively (never re-sorts)', () => {
    const entries = [
      { date: '2024-01-10', id: 'a' },
      { date: '2024-01-02', id: 'b' },
      { date: '2024-01-09', id: 'c' }, // same week as 'a', but not adjacent
    ]
    const groups = groupByWeek(entries)
    expect(groups).toHaveLength(3)
  })
})

describe('weekGroupLabel', () => {
  it('has an honest label for an unknown key', () => {
    expect(weekGroupLabel('unknown')).toBe('Date inconnue')
  })
  it('formats a real week key', () => {
    expect(weekGroupLabel('2024-01-08')).toBe('Semaine du 8 janvier')
  })
})
