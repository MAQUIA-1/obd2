import { describe, expect, it } from 'vitest'
import { advanceGround, groundVelocity, GROUND_PERIOD } from './ground-motion'

describe('ground motion', () => {
  it('stops at zero speed and in Park', () => {
    expect(groundVelocity(0, 'drive')).toBe(0)
    expect(groundVelocity(60, 'park')).toBe(0)
    expect(advanceGround(0.5, 0, 0.016)).toBeCloseTo(0.5)
    expect(groundVelocity(NaN, 'drive')).toBe(0)
  })
  it('scales with speed and reverses direction in R', () => {
    expect(groundVelocity(40, 'drive')).toBeCloseTo(groundVelocity(20, 'drive') * 2)
    expect(groundVelocity(20, 'reverse')).toBe(-groundVelocity(20, 'drive'))
    expect(groundVelocity(20, 'neutral')).toBe(groundVelocity(20, 'drive'))
  })
  it('travels the same distance at different frame rates', () => {
    const run = (frames: number) => {
      let phase = 0
      for (let i = 0; i < frames; i++) phase = advanceGround(phase, 0.5, 1 / frames)
      return phase
    }
    expect(run(30)).toBeCloseTo(run(60))
  })
  it('wraps in both directions and limits resume jumps', () => {
    expect(advanceGround(1.1, 2, 0.1)).toBeCloseTo(0.1)
    expect(advanceGround(0.1, -2, 0.1)).toBeCloseTo(GROUND_PERIOD - 0.1)
    expect(advanceGround(0, 2, 10)).toBeCloseTo(advanceGround(0, 2, 0.1))
  })
})
