import { describe, expect, it } from 'vitest'
import { smoothFuelPct } from './fuel-level'

const maxGap = 25_000

describe('displayed fuel level', () => {
  it('uses the first reading and restarts after an expired sample', () => {
    expect(smoothFuelPct(35, 100, undefined, maxGap)).toBe(35)
    expect(smoothFuelPct(75, 25_001, { value: 35, at: 0 }, maxGap)).toBe(75)
  })

  it('dampens a momentary increase and decrease', () => {
    const starting = { value: 50, at: 0 }
    expect(smoothFuelPct(60, 10_000, starting, maxGap)).toBeCloseTo(51.5, 1)
    expect(smoothFuelPct(40, 10_000, starting, maxGap)).toBeCloseTo(48.5, 1)
  })

  it('responds the same way over the same elapsed time with irregular polling', () => {
    const starting = { value: 40, at: 0 }
    const first = smoothFuelPct(50, 8000, starting, maxGap)
    const second = smoothFuelPct(50, 20_000, { value: first, at: 8000 }, maxGap)
    expect(second).toBeCloseTo(smoothFuelPct(50, 20_000, starting, maxGap))
  })

  it('converges toward a sustained change', () => {
    let previous = { value: 40, at: 0 }
    for (let at = 10_000; at <= 60_000; at += 10_000) {
      previous = { value: smoothFuelPct(50, at, previous, maxGap), at }
    }
    expect(previous.value).toBeCloseTo(46.32)
  })
})
