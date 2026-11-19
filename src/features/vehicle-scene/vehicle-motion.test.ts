import { describe, expect, it } from 'vitest'
import { steeringGuide } from './steering-guide'
import { advanceGroundPose, groundVelocity, GROUND_PERIOD } from './ground-motion'
import { steeringCurvature, vehicleStep, frontWheelAngle, VEHICLE, WHEELBASE, MAX_STEERING_DEG, MODEL_SCALE_Z, REAR_AXLE_Z, REAR_BUMPER_Z, GUIDE_HALF_WIDTH } from './vehicle-motion'

describe('shared vehicle motion', () => {
  it('stays still while steering at zero speed', () => {
    const pose = { x: 0.3, z: 0.6, heading: 0.4 }
    expect(advanceGroundPose(pose, 0, steeringCurvature(360), 0.1)).toEqual(pose)
  })
  it('drives forward and reverses the same arc back to its origin', () => {
    let pose = { x: 0, z: 0, heading: 0 }
    const curvature = steeringCurvature(180)
    for (let i = 0; i < 30; i++) pose = advanceGroundPose(pose, 2, curvature, 1 / 30)
    expect(pose.heading).toBeGreaterThan(0)
    for (let i = 0; i < 30; i++) pose = advanceGroundPose(pose, -2, curvature, 1 / 30)
    expect(Math.min(pose.x, GROUND_PERIOD - pose.x)).toBeLessThan(1e-10)
    expect(Math.min(pose.z, GROUND_PERIOD - pose.z)).toBeLessThan(1e-10)
    expect(pose.heading).toBeCloseTo(0)
  })
  it('uses the same curved trajectory at different frame rates', () => {
    const run = (frames: number) => {
      let pose = { x: 0, z: 0, heading: 0 }
      for (let i = 0; i < frames; i++) pose = advanceGroundPose(pose, 3, steeringCurvature(360), 1 / frames)
      return pose
    }
    const slow = run(20)
    const fast = run(120)
    expect(slow.x).toBeCloseTo(fast.x)
    expect(slow.z).toBeCloseTo(fast.z)
    expect(slow.heading).toBeCloseTo(fast.heading)
  })
  it('mirrors left and right, reverses yaw in reverse, and stays straight at zero steering', () => {
    const right = vehicleStep(2, steeringCurvature(180))
    const left = vehicleStep(2, steeringCurvature(-180))
    const reverse = vehicleStep(-2, steeringCurvature(180))
    expect(left.x).toBeCloseTo(-right.x)
    expect(left.z).toBeCloseTo(right.z)
    expect(reverse.heading).toBeCloseTo(-right.heading)
    expect(vehicleStep(2, 0)).toEqual({ x: 0, z: -2, heading: 0 })
  })
})

describe('LF specification and metric consistency', () => {
  it('converts 143 degrees of steering wheel rotation to 10 degrees at the equivalent road wheel', () => {
    expect(steeringCurvature(143)).toBeCloseTo(Math.tan(Math.PI / 18) / 2.805, 12)
    expect(steeringCurvature(-143)).toBeCloseTo(-steeringCurvature(143), 12)
  })
  it('converts 36km/h to 10m/s without compression, including at 120km/h', () => {
    expect(groundVelocity(36, 'drive')).toBe(10)
    expect(groundVelocity(36, 'reverse')).toBe(-10)
    expect(groundVelocity(120, 'drive')).toBeCloseTo(120 / 3.6)
    const pose = advanceGroundPose({x: 0, z: 0, heading: 0}, 10, 0, 0.1)
    expect(pose.z).toBeCloseTo(0.2) // -1 metre wrapped at 1.2m pattern spacing.
  })
  it('gives inner/outer front wheels a common instantaneous rotation centre', () => {
    const curvature = steeringCurvature(300)
    const leftRadius = WHEELBASE / Math.tan(frontWheelAngle(300, -1)) - VEHICLE.frontTrack / 2
    const rightRadius = WHEELBASE / Math.tan(frontWheelAngle(300, 1)) + VEHICLE.frontTrack / 2
    expect(leftRadius).toBeCloseTo(1 / curvature, 12)
    expect(rightRadius).toBeCloseTo(leftRadius, 12)
    expect(frontWheelAngle(300, 1)).toBeGreaterThan(frontWheelAngle(300, -1))
  })
  it('uses a 2.78-turn physical steering range and normalizes the model axle spacing', () => {
    expect(MAX_STEERING_DEG).toBeCloseTo(500.4)
    expect(steeringCurvature(900)).toBe(steeringCurvature(MAX_STEERING_DEG))
    expect(MODEL_SCALE_Z * 2.737980246543884).toBeCloseTo(2.805, 12)
    expect(steeringCurvature(NaN)).toBe(0)
  })
  it('makes the rear bumper follow the guide under the same speed-based ground transform', () => {
    for (const angle of [-500.4, -143, 0, 143, 500.4]) {
      const curvature = steeringCurvature(angle)
      let ground = { x: 0, z: 0, heading: 0 }
      for (let i = 0; i < 33; i++) ground = advanceGroundPose(ground, -1, curvature, 0.1)
      for (const side of [-1, 1] as const) {
        const point = steeringGuide(angle, side).at(-1)!
        const c = Math.cos(ground.heading), s = Math.sin(ground.heading)
        const bumper = REAR_BUMPER_Z + 0.05 - REAR_AXLE_Z
        const worldX = c * side * GUIDE_HALF_WIDTH - s * bumper + ground.x
        const worldZ = s * side * GUIDE_HALF_WIDTH + c * bumper + ground.z
        // Ground translation wraps at the same spacing as the shader pattern.
        const periodsX = (point[0] - worldX) / GROUND_PERIOD
        const periodsZ = (point[2] - REAR_AXLE_Z - worldZ) / GROUND_PERIOD
        expect(periodsX).toBeCloseTo(Math.round(periodsX), 10)
        expect(periodsZ).toBeCloseTo(Math.round(periodsZ), 10)
      }
    }
  })
})
