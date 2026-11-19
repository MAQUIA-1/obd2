import { create } from 'zustand'
import { DEMO_SCENARIOS, type DemoScenario } from '../features/drive-status/demo-scenarios'
import { clampSteering } from '../features/vehicle-scene/vehicle-motion'

export type ViewMode = 'park' | 'reverse' | 'neutral' | 'drive'

type DemoState = {
  view: ViewMode
  scenario: DemoScenario
  setScenario: (scenario: DemoScenario) => void
  speedKph: number
  setSpeed: (speed: number) => void
  steeringDeg: number
  setView: (view: ViewMode) => void
  setSteering: (angle: number) => void
}

// Presentation controls only. This store does not represent a vehicle connection.
export const useDemo = create<DemoState>((set) => ({
  view: 'park',
  scenario: 'observed',
  setScenario: (scenario) => set({ scenario, view: 'drive', speedKph: DEMO_SCENARIOS[scenario].speed }),
  steeringDeg: 0,
  speedKph: 0,
  setSpeed: (speed) => set((state) => ({ speedKph: state.view === 'park' || !Number.isFinite(speed) ? 0 : Math.max(0, Math.min(120, speed)) })),
  setView: (view) => set((state) => ({ view, speedKph: view === 'park' ? 0 : state.speedKph })),
  setSteering: (steeringDeg) => set({ steeringDeg: clampSteering(steeringDeg) }),
}))
