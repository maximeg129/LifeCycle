import { describe, it, expect } from 'vitest'
import { computeIntervalAdherence } from './interval-adherence-types'
import type { WorkoutProfileStep } from '@/components/cycling/plan-calendar-types'

const FTP = 200

function watts(...segments: { seconds: number; w: number }[]): number[] {
  return segments.flatMap((s) => Array(s.seconds).fill(s.w))
}

describe('computeIntervalAdherence', () => {
  const plannedSteps: WorkoutProfileStep[] = [
    { durationSeconds: 60, pctFtp: 60, pctFtpLow: 55, pctFtpHigh: 65 }, // warmup ~120W
    { durationSeconds: 60, pctFtp: 100, pctFtpLow: 95, pctFtpHigh: 105 }, // interval ~200W
    { durationSeconds: 60, pctFtp: 50, pctFtpLow: 50, pctFtpHigh: 50 }, // recovery ~100W
  ]

  it('marks a step "within" when the real average power lands inside the target range', () => {
    const stream = watts({ seconds: 60, w: 120 }, { seconds: 60, w: 200 }, { seconds: 60, w: 100 })
    const result = computeIntervalAdherence(stream, plannedSteps, FTP)
    expect(result).not.toBeNull()
    expect(result!.steps.map((s) => s.verdict)).toEqual(['within', 'within', 'within'])
    expect(result!.withinCount).toBe(3)
    expect(result!.belowCount).toBe(0)
    expect(result!.aboveCount).toBe(0)
  })

  it('marks a step "below" when the athlete undershot the target', () => {
    // Interval target 95-105% (190-210W) but only 170W actually held.
    const stream = watts({ seconds: 60, w: 120 }, { seconds: 60, w: 170 }, { seconds: 60, w: 100 })
    const result = computeIntervalAdherence(stream, plannedSteps, FTP)
    expect(result!.steps[1].verdict).toBe('below')
    expect(result!.steps[1].actualPctFtp).toBe(85)
    expect(result!.belowCount).toBe(1)
  })

  it('marks a step "above" when the athlete overshot the target', () => {
    const stream = watts({ seconds: 60, w: 120 }, { seconds: 60, w: 240 }, { seconds: 60, w: 100 })
    const result = computeIntervalAdherence(stream, plannedSteps, FTP)
    expect(result!.steps[1].verdict).toBe('above')
    expect(result!.aboveCount).toBe(1)
  })

  it('falls back to pctFtp for both bounds when a step has no explicit low/high', () => {
    const looseSteps: WorkoutProfileStep[] = [{ durationSeconds: 60, pctFtp: 100 }]
    const stream = watts({ seconds: 60, w: 200 })
    const result = computeIntervalAdherence(stream, looseSteps, FTP)
    expect(result!.steps[0]).toMatchObject({ targetPctLow: 100, targetPctHigh: 100, verdict: 'within' })
  })

  it('returns null when the real ride duration drifted too far from the planned duration (misaligned slicing would mislead)', () => {
    // Planned 180s total, actual only 90s (50% shorter — beyond the ±25% tolerance).
    const stream = watts({ seconds: 90, w: 150 })
    expect(computeIntervalAdherence(stream, plannedSteps, FTP)).toBeNull()
  })

  it('returns null without a watts stream, without FTP, or without planned steps', () => {
    const stream = watts({ seconds: 180, w: 150 })
    expect(computeIntervalAdherence(undefined, plannedSteps, FTP)).toBeNull()
    expect(computeIntervalAdherence([], plannedSteps, FTP)).toBeNull()
    expect(computeIntervalAdherence(stream, plannedSteps, null)).toBeNull()
    expect(computeIntervalAdherence(stream, plannedSteps, 0)).toBeNull()
    expect(computeIntervalAdherence(stream, [], FTP)).toBeNull()
  })
})
