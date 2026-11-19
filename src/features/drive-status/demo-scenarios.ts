import { DEMO_READINGS } from '../vehicle-info/demo-readings'
import type { Gear, Sample, Snapshot } from './state-machine'

// Every preset contains only fields already available from the current PID parser.
// These are raw-value examples, not asserted EV/regen flags or recorded road captures.
export const DEMO_SCENARIOS = {
  observed: { label: '기본 목업', rpm: DEMO_READINGS.rpm, current: DEMO_READINGS.batteryCurrentA, speed: 30, deceleration: 0 },
  engineOffLoad: { label: 'RPM 0 · 전류 +28A', rpm: 0, current: 28, speed: 30, deceleration: 0 },
  engineLoad: { label: 'RPM 1800 · 전류 +28A', rpm: 1800, current: 28, speed: 40, deceleration: 0 },
  engineLowLoad: { label: 'RPM 1800 · 전류 +1.3A', rpm: 1800, current: 1.3, speed: 40, deceleration: 0 },
  lowLoad: { label: 'RPM 0 · 전류 +1.3A', rpm: 0, current: 1.3, speed: 40, deceleration: 0 },
  slowingCharge: { label: 'RPM 0 · 감속 · 전류 −24A', rpm: 0, current: -24, speed: 60, deceleration: 2 },
  slowingLowLoad: { label: 'RPM 0 · 감속 · 전류 +1.3A', rpm: 0, current: 1.3, speed: 60, deceleration: 2 },
  engineCharge: { label: 'RPM 1600 · 전류 −12A', rpm: 1600, current: -12, speed: 40, deceleration: 0 },
  stoppedCharge: { label: '정차 · RPM 1200 · 전류 −12A', rpm: 1200, current: -12, speed: 0, deceleration: 0 },
} as const
export type DemoScenario = keyof typeof DEMO_SCENARIOS
export type DemoStatusInput = { view: 'park' | 'reverse' | 'neutral' | 'drive'; speedKph: number; scenario: DemoScenario }
export function demoActivity(input: DemoStatusInput) {
  const scenario = DEMO_SCENARIOS[input.view === 'drive' ? input.scenario : 'observed']
  return { rpm: scenario.rpm, batteryCurrentA: scenario.current }
}
export function demoSnapshot(input: DemoStatusInput, at: number): Snapshot {
  const activity = demoActivity(input)
  const sample = <T,>(value: T): Sample<T> => ({ value, at, verified: true })
  const gear: Gear = input.view === 'park' ? 'P' : input.view === 'reverse' ? 'R' : input.view === 'neutral' ? 'N' : 'D'
  return { connected: true, signals: { speed: sample(input.speedKph), gear: sample(gear),
    rpm: sample(activity.rpm), batteryCurrent: sample(activity.batteryCurrentA) } }
}
