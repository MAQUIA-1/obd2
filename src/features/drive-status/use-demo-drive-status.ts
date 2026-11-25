import { useEffect, useState } from 'react'
import { useDemo } from '../../stores/demo'
import { DEMO_SCENARIOS, demoSnapshot } from './demo-scenarios'
import { DriveStatusMachine, LABELS, type Result } from './state-machine'

// Dedicated synthetic feed: the application has no live vehicle transport yet.
export function useDemoDriveStatus(enabled: boolean) {
  const [result, setResult] = useState<Pick<Result, 'status' | 'inferred'>>({ status: 'waiting', inferred: false })
  useEffect(() => {
    if (!enabled) return
    const machine = new DriveStatusMachine()
    let nextSample = 0
    let input = useDemo.getState()
    let snapshot = demoSnapshot(input, performance.now())
    const evaluate = (resample = false) => {
      const now = performance.now()
      if (resample || now >= nextSample) {
        input = useDemo.getState()
        if (!resample && input.view === 'drive') {
          const deceleration = DEMO_SCENARIOS[input.scenario].deceleration
          if (deceleration && input.speedKph > 0) {
            // Reuse the actual speed store so the scene, speedometer and inference agree.
            useDemo.getState().setSpeed(Math.max(0, input.speedKph - deceleration))
            return
          }
        }
        snapshot = demoSnapshot(input, now)
        nextSample = now + 1000
      }
      const next = machine.update(snapshot, now)
      setResult(previous => previous.status === next.status && previous.inferred === next.inferred
        ? previous : { status: next.status, inferred: next.inferred })
    }
    evaluate(true)
    // A repaint is not a new sample: evaluate every 250ms, synthesize a packet every second.
    const timer = window.setInterval(() => evaluate(), 250)
    const unsubscribe = useDemo.subscribe((state, previous) => {
      if (state.view !== previous.view || state.speedKph !== previous.speedKph || state.scenario !== previous.scenario) evaluate(true)
    })
    return () => { window.clearInterval(timer); unsubscribe() }
  }, [enabled])
  return { ...result, label: LABELS[result.status] }
}
