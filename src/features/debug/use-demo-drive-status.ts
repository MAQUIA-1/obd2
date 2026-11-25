import { useEffect, useState } from 'react'
import { useDemo } from './demo-store'
import { DEMO_SCENARIOS, demoSnapshot } from './demo-scenarios'
import { DriveStatusMachine, type Status } from '../drive-status/state-machine'

export function useDemoDriveStatus() {
  const [status, setStatus] = useState<Status>('waiting')
  useEffect(() => {
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
      setStatus(machine.update(snapshot, now).status)
    }
    evaluate(true)
    // A repaint is not a new sample: evaluate every 250ms, synthesize a packet every second.
    const timer = window.setInterval(() => evaluate(), 250)
    const unsubscribe = useDemo.subscribe((state, previous) => {
      if (state.view !== previous.view || state.speedKph !== previous.speedKph || state.scenario !== previous.scenario) evaluate(true)
    })
    return () => { window.clearInterval(timer); unsubscribe() }
  }, [])
  return status
}
