import { describe, expect, it } from 'vitest'
import { DriveStatusMachine, type Signals, type Snapshot, type Status } from './state-machine'
type Values = { [K in keyof Signals]?: Signals[K]['value'] }
function packet(at: number, values: Values = {}): Snapshot {
  const signals: Partial<Signals> = {}
  for (const [key, value] of Object.entries({ speed: 30, gear: 'D', rpm: 1500, batteryCurrent: 1.3, ...values })) {
    Object.assign(signals, { [key]: { value, at, verified: true } })
  }
  return { connected: true, signals }
}
function run(values: Values, speeds = [30, 30, 30]) {
  const machine = new DriveStatusMachine()
  let result = machine.update(packet(0, { ...values, speed: speeds[0] }), 0)
  for (let i = 1; i < speeds.length; i++) result = machine.update(packet(i * 1000, { ...values, speed: speeds[i] }), i * 1000)
  return result
}
describe('inference from available speed/RPM/current/gear only', () => {
  it.each([
    ['EV', { rpm: 0, batteryCurrent: 20 }, [30, 30, 30], 'ev'],
    ['hybrid', { rpm: 1800, batteryCurrent: 20 }, [30, 32, 34], 'hybrid'],
    ['engine', { rpm: 1800, batteryCurrent: 1.3 }, [30, 30, 30], 'engine'],
    ['coast', { rpm: 0, batteryCurrent: 1.3 }, [30, 30, 30], 'coast'],
    ['regen', { rpm: 0, batteryCurrent: -20 }, [40, 37, 34], 'regen'],
    ['charging while engine turns', { rpm: 1800, batteryCurrent: -20 }, [40, 37, 34], 'chargingMoving'],
    ['constant speed charging', { rpm: 0, batteryCurrent: -20 }, [40, 40, 40], 'chargingMoving'],
    ['stationary charging', { rpm: 1200, batteryCurrent: -20 }, [0, 0, 0], 'charging'],
  ] as [string, Values, number[], Status][])('%s is an estimate', (_, values, speeds, expected) => {
    const result = run(values, speeds)
    expect(result.status).toBe(expected)
    expect(result.inferred).toBe(true)
    expect(result.evidence.sort()).toEqual(['batteryCurrent', 'gear', 'rpm', 'speed'])
  })
  it('does not classify deceleration as friction braking, engine braking or coasting', () => {
    for (const rpm of [0, 1500]) for (const current of [0, 1.3, 20]) {
      const result = run({ rpm, batteryCurrent: current }, [40, 37, 34])
      expect(result.status).toBe('decelerating')
      expect(result.inferred).toBe(false)
    }
  })
  it('does not call low-current acceleration engine-off coasting', () => {
    expect(run({ rpm: 0, batteryCurrent: 1.3 }, [30, 33, 36]).status).toBe('engineOff')
  })
  it('uses observed engine state when electrical data is missing', () => {
    const snapshot = packet(0, { rpm: 0 })
    delete snapshot.signals.batteryCurrent
    const result = new DriveStatusMachine().update(snapshot, 0)
    expect(result.status).toBe('engineOff')
    expect(result.inferred).toBe(false)
  })
  it('does not assign drive inference at walking speed or to N/R', () => {
    expect(run({ rpm: 0, batteryCurrent: 20 }, [3, 3, 3]).status).toBe('engineOff')
    expect(run({ gear: 'N', rpm: 0, batteryCurrent: 20 }).status).toBe('neutral')
    expect(run({ gear: 'R', rpm: 0, batteryCurrent: -20 }).status).toBe('reverse')
    expect(run({ gear: 'P' }).status).toBe('checking')
  })
  it('does not infer EV or generation while stationary', () => {
    expect(run({ rpm: 0, batteryCurrent: 20 }, [0, 0, 0]).status).toBe('stopped')
    expect(run({ rpm: 1500, batteryCurrent: 1.3 }, [0, 0, 0]).status).toBe('stoppedEngine')
  })
})
describe('temporal stability and input quality', () => {
  it('uses hysteresis for motion and leaves an initial 1km/h observation unresolved', () => {
    const machine = new DriveStatusMachine()
    const at = (t: number, speed: number) => machine.update(packet(t, { speed, rpm: 0 }), t).facts.motion
    expect(at(0, 1)).toBe('unknown')
    expect(at(1000, 0)).toBe('stopped')
    expect(at(2000, 1)).toBe('stopped')
    expect(at(3000, 2)).toBe('moving')
    expect(at(4000, 1)).toBe('moving')
    expect(at(5000, 0)).toBe('stopped')
  })
  it('separates aux-sized currents from discharge and prevents threshold chatter', () => {
    const machine = new DriveStatusMachine()
    const flows = [4, 5, 4, 3, -4, -5, -4, -3].map((batteryCurrent, i) =>
      machine.update(packet(i * 1000, { batteryCurrent }), i * 1000).facts.batteryFlow)
    expect(flows).toEqual(['unknown', 'discharging', 'discharging', 'low', 'unknown', 'charging', 'charging', 'low'])
  })
  it('supports opposite current polarity as a calibration policy', () => {
    const machine = new DriveStatusMachine({ dischargeSign: -1 })
    for (const at of [0, 1000, 2000]) machine.update(packet(at, { rpm: 0, batteryCurrent: -20 }), at)
    expect(machine.update(packet(3000, { rpm: 0, batteryCurrent: -20 }), 3000).status).toBe('ev')
  })
  it('does not count repeated frames or a single fast field as independent inference evidence', () => {
    const machine = new DriveStatusMachine()
    machine.update(packet(0, { rpm: 0, batteryCurrent: 20 }), 0)
    const frame = packet(1000, { rpm: 0, batteryCurrent: 20 })
    expect(machine.update(frame, 1000).pending).toBe('ev')
    for (const time of [1200, 1500, 1800]) expect(machine.update(frame, time).status).toBe('engineOff')
    const mixed = packet(2000, { rpm: 0, batteryCurrent: 20 })
    mixed.signals.batteryCurrent = frame.signals.batteryCurrent
    expect(machine.update(mixed, 2000).status).toBe('engineOff')
    expect(machine.update(packet(2500, { rpm: 0, batteryCurrent: 20 }), 2500).status).toBe('ev')
  })
  it('requires confirmation and drops EV immediately when charging or stopping replaces it', () => {
    const machine = new DriveStatusMachine()
    for (const at of [0, 1000, 2000]) machine.update(packet(at, { rpm: 0, batteryCurrent: 20 }), at)
    const switched = machine.update(packet(3000, { rpm: 0, batteryCurrent: -20 }), 3000)
    expect(switched.status).not.toBe('ev')
    expect(switched.pending).toBe('chargingMoving')
    expect(machine.update(packet(4000, { speed: 0, rpm: 0, batteryCurrent: -20 }), 4000).status).toBe('stopped')
  })
  it('requires a real speed history and does not infer a trend from repeated frames', () => {
    const machine = new DriveStatusMachine()
    const first = packet(0, { rpm: 0, batteryCurrent: -20 })
    machine.update(first, 0)
    expect(machine.update(first, 1000).facts.trend).toBe('unknown')
    expect(machine.update(packet(5000, { speed: 10, rpm: 0, batteryCurrent: -20 }), 5000).facts.trend).toBe('unknown')
  })
  it('does not turn integer-speed jitter into deceleration', () => {
    const result = run({ rpm: 0, batteryCurrent: -20 }, [30, 29, 30])
    expect(result.facts.trend).toBe('steady')
    expect(result.status).toBe('chargingMoving')
  })
  it('expires old electrical evidence without losing fresh motion', () => {
    const machine = new DriveStatusMachine()
    const old = packet(1000, { rpm: 0, batteryCurrent: 20 })
    machine.update(old, 1000)
    const current = packet(5000, { rpm: 0 })
    current.signals.batteryCurrent = old.signals.batteryCurrent
    expect(machine.update(current, 5000).status).toBe('engineOff')
    expect(machine.update(current, 9000).status).toBe('waiting')
  })
  it('does not combine current and RPM that are individually fresh but too far apart', () => {
    const machine = new DriveStatusMachine()
    const mixed = packet(2000, { rpm: 0, batteryCurrent: 20 })
    mixed.signals.batteryCurrent!.at = 0
    expect(machine.update(mixed, 2000).facts.batteryFlow).toBe('unknown')
  })
  it('rejects missing, invalid, future, unverified and reverse-ordered samples', () => {
    const machine = new DriveStatusMachine()
    machine.update(packet(1000), 1000)
    expect(machine.update(packet(500), 1500).status).toBe('waiting')
    expect(machine.update(packet(3000), 2000).status).toBe('waiting')
    const unverified = packet(3000)
    unverified.signals.speed!.verified = false
    expect(machine.update(unverified, 3000).status).toBe('waiting')
    expect(machine.update(packet(4000, { speed: NaN }), 4000).status).toBe('waiting')
    expect(machine.update(packet(5000, { speed: -1 }), 5000).status).toBe('waiting')
    const missing = packet(6000); delete missing.signals.gear
    expect(machine.update(missing, 6000).status).toBe('waiting')
    const badRpm = packet(7000, { rpm: NaN })
    expect(machine.update(badRpm, 7000).facts.engineRotating).toBeNull()
  })
  it('resets trend and hysteresis across disconnect and gear changes', () => {
    const machine = new DriveStatusMachine()
    machine.update(packet(0), 0)
    machine.update(packet(1000, { speed: 25 }), 1000)
    expect(machine.update(packet(2000, { speed: 20, gear: 'N' }), 2000).facts.trend).toBe('unknown')
    expect(machine.update({ connected: false, signals: {} }, 3000).status).toBe('offline')
    expect(machine.update(packet(2000), 3500).status).toBe('waiting')
    expect(machine.update(packet(4000), 4000).facts.trend).toBe('unknown')
    expect(() => machine.update(packet(3500), 3500)).toThrow('monotonic')
  })
})
