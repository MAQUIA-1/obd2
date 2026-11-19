import { GUIDE_HALF_WIDTH, GUIDE_LENGTH, REAR_AXLE_Z, REAR_BUMPER_Z, steeringCurvature, vehicleStep } from './vehicle-motion'

export type GuidePoint = [number, number, number]

export function steeringGuide(angleDeg: number, side: -1 | 1): GuidePoint[] {
  const curvature = steeringCurvature(angleDeg)
  const bumperOffset = REAR_BUMPER_Z + 0.05 - REAR_AXLE_Z
  return Array.from({ length: 49 }, (_, i) => {
    const pose = vehicleStep(-i / 48 * GUIDE_LENGTH, curvature)
    const c = Math.cos(pose.heading)
    const s = Math.sin(pose.heading)
    return [pose.x + c * side * GUIDE_HALF_WIDTH - s * bumperOffset, 0.025,
      REAR_AXLE_Z + pose.z + s * side * GUIDE_HALF_WIDTH + c * bumperOffset]
  })
}
