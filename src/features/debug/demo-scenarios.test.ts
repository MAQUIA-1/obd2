import { describe, expect, it } from 'vitest'
import { DEMO_SCENARIOS, demoSnapshot, demoActivity, type DemoScenario } from './demo-scenarios'
import { DriveStatusMachine, type Status } from '../drive-status/state-machine'
const expected: Record<DemoScenario, Status> = {
  observed: 'engine', engineOffLoad: 'ev', engineLoad: 'hybrid', engineLowLoad: 'engine', lowLoad: 'coast',
  slowingCharge: 'regen', slowingLowLoad: 'decelerating', engineCharge: 'chargingMoving', stoppedCharge: 'charging',
}
describe('raw-value demo adapter', () => {
  it.each(Object.keys(DEMO_SCENARIOS) as DemoScenario[])('%s is inferred from available fields only', (scenario) => {
    const machine = new DriveStatusMachine()
    const preset = DEMO_SCENARIOS[scenario]
    let status: Status = 'waiting'
    for (const seconds of [0, 1, 2, 3]) {
      const snapshot = demoSnapshot({ view: 'drive', speedKph: Math.max(0, preset.speed - seconds * preset.deceleration), scenario }, seconds * 1000)
      expect(Object.keys(snapshot.signals).sort()).toEqual(['batteryCurrent', 'gear', 'rpm', 'speed'])
      status = machine.update(snapshot, seconds * 1000).status
    }
    expect(status).toBe(expected[scenario])
  })
  it('keeps non-D activity readings at their original demo values', () => {
    for (const view of ['park', 'neutral', 'reverse'] as const) {
      expect(demoActivity({ view, speedKph: 30, scenario: 'engineLoad' })).toEqual({ rpm: 1500, batteryCurrentA: 1.3 })
    }
  })
})
