// SI units. Sources, market assumptions, GLB measurements: research/차량_운동_모델.md.
export const VEHICLE = {
  wheelbase: 2.805,
  width: 1.865,
  frontTrack: 1.614, // 16-inch baseline; 17-inch: 1.602m. Actual trim unconfirmed.
  rearTrack: 1.621,
  steeringRatio: 14.3, // Hyundai LF HEV North American specification; KR unverified.
  lockToLockTurns: 2.78,
} as const
export const MAX_STEERING_DEG = VEHICLE.lockToLockTurns * 180
export const WHEELBASE = VEHICLE.wheelbase
export const MODEL_SCALE_Z = WHEELBASE / 2.737980246543884
export const MODEL_SCALE_X = VEHICLE.frontTrack / 1.521100103855133
export const REAR_AXLE_Z = 1.3142426013946533 * MODEL_SCALE_Z
export const REAR_BUMPER_Z = 2.3757619857788086 * MODEL_SCALE_Z
export const GUIDE_HALF_WIDTH = VEHICLE.width / 2 + 0.05
export const GUIDE_LENGTH = 3.3

export function clampSteering(angleDeg: number) {
  return Number.isFinite(angleDeg) ? Math.max(-MAX_STEERING_DEG, Math.min(MAX_STEERING_DEG, angleDeg)) : 0
}

// Input is steering wheel angle: negative left, positive right (matches captured SAS).
export function steeringCurvature(angleDeg: number) {
  const roadWheelAngle = clampSteering(angleDeg) / VEHICLE.steeringRatio * Math.PI / 180
  return Math.tan(roadWheelAngle) / WHEELBASE
}

// Ideal Ackermann angles, with right-side wheel at positive lateral position.
export function frontWheelAngle(angleDeg: number, side: -1 | 1) {
  const curvature = steeringCurvature(angleDeg)
  return Math.atan(WHEELBASE * curvature / (1 - side * VEHICLE.frontTrack / 2 * curvature))
}

// Signed distance: forward positive. Heading turns clockwise in the ground X/Z plane.
export function vehicleStep(distance: number, curvature: number) {
  const heading = distance * curvature
  const x = Math.abs(curvature) < 1e-8 ? 0 : (1 - Math.cos(heading)) / curvature
  const z = Math.abs(curvature) < 1e-8 ? -distance : -Math.sin(heading) / curvature
  return { x, z, heading }
}
