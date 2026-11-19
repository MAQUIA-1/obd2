import { vehicleStep } from './vehicle-motion'
import type { ViewMode } from '../../stores/demo'

export const GROUND_PERIOD = 1.2

// World -Z is forward; the ground flows toward +Z when the car drives forward.
// One world unit is one metre: no display speed compression.
export function groundVelocity(speedKph: number, view: ViewMode): number {
  if (view === 'park' || !Number.isFinite(speedKph) || speedKph <= 0) return 0
  return (speedKph / 3.6) * (view === 'reverse' ? -1 : 1)
}

export function advanceGround(phase: number, velocity: number, elapsed: number): number {
  // Avoid a large jump after a hidden tab resumes.
  const delta = Math.max(0, Math.min(elapsed, 0.1))
  return ((phase + velocity * delta) % GROUND_PERIOD + GROUND_PERIOD) % GROUND_PERIOD
}

export type GroundPose = { x: number; z: number; heading: number }

// Integrate the rear axle in world space; the shader samples a rigid world pattern.
export function advanceGroundPose(pose: GroundPose, velocity: number, curvature: number, elapsed: number): GroundPose {
  if (velocity === 0 || elapsed <= 0) return pose
  const step = vehicleStep(velocity * Math.max(0, Math.min(elapsed, 0.1)), curvature)
  const c = Math.cos(pose.heading)
  const s = Math.sin(pose.heading)
  const wrap = (value: number) => ((value % GROUND_PERIOD) + GROUND_PERIOD) % GROUND_PERIOD
  return {
    x: wrap(pose.x + c * step.x - s * step.z),
    z: wrap(pose.z + s * step.x + c * step.z),
    heading: (pose.heading + step.heading) % (2 * Math.PI),
  }
}
