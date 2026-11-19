import { describe, expect, it } from 'vitest'
import { GUIDE_HALF_WIDTH, MAX_STEERING_DEG, REAR_BUMPER_Z } from './vehicle-motion'
import { steeringGuide } from './steering-guide'

describe('bicycle model body-edge guide', () => {
  it('is straight when centered and keeps the two edges separated', () => {
    const left = steeringGuide(0, -1)
    const right = steeringGuide(0, 1)
    left.forEach((point, i) => {
      expect(point[0]).toBe(-GUIDE_HALF_WIDTH)
      expect(right[i][0] - point[0]).toBeCloseTo(GUIDE_HALF_WIDTH * 2)
      expect(point[1]).toBeGreaterThan(0)
    })
  })
  it('bends negative steering left and positive steering right, without moving the start', () => {
    const left = steeringGuide(-180, -1)
    const right = steeringGuide(180, -1)
    expect(left[0]).toEqual(right[0])
    expect(left.at(-1)![0]).toBeLessThan(left[0][0])
    expect(right.at(-1)![0]).toBeGreaterThan(right[0][0])
  })
  it('stays entirely behind the rear bumper and extends backwards', () => {
    for (const angle of [-360, 0, 360]) {
      const points = steeringGuide(angle, 1)
      expect(points.every((point) => point[2] >= REAR_BUMPER_Z)).toBe(true)
      expect(points.at(-1)![2]).toBeGreaterThan(points[0][2])
    }
  })
  it('limits the bend at full scale', () => {
    expect(steeringGuide(720, 1)).toEqual(steeringGuide(MAX_STEERING_DEG, 1))
  })
})
