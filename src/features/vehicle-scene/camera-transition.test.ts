import { describe, expect, it } from 'vitest'
import { Camera, Vector3 } from 'three'
import { cameraPose, CameraTransition } from './camera-transition'

describe('fixed-duration camera transitions', () => {
  it('reaches R completely in 850ms, including on a low frame rate', () => {
    const camera = new Camera()
    const start = cameraPose('park', 1)
    camera.position.copy(start.position)
    camera.quaternion.copy(start.quaternion)
    const target = cameraPose('reverse', 1)
    const transition = new CameraTransition()
    transition.begin(camera, target, 10)
    transition.update(camera, 10.1)
    expect(transition.active).toBe(true)
    transition.update(camera, 10.9)
    expect(transition.active).toBe(false)
    expect(camera.position.distanceTo(target.position)).toBeLessThan(1e-8)
    expect(camera.quaternion.angleTo(target.quaternion)).toBeLessThan(1e-7)
    const rotation = camera.quaternion.clone()
    transition.update(camera, 20)
    expect(camera.quaternion.equals(rotation)).toBe(true)
  })
  it('can interrupt a transition from the currently displayed pose', () => {
    const camera = new Camera()
    const transition = new CameraTransition()
    transition.begin(camera, cameraPose('reverse', 1), 0)
    transition.update(camera, 0.1)
    const current = camera.position.clone()
    const rotation = camera.quaternion.clone()
    transition.begin(camera, cameraPose('drive', 1), 0.1)
    transition.update(camera, 0.1)
    expect(camera.position.equals(current)).toBe(true)
    expect(camera.quaternion.equals(rotation)).toBe(true)
    transition.update(camera, 1)
    expect(transition.active).toBe(false)
  })
  it('keeps the vehicle center near the viewing axis throughout every view change', () => {
    for (const from of ['park', 'drive', 'reverse'] as const) {
      for (const to of ['park', 'drive', 'reverse'] as const) {
        const camera = new Camera()
        const start = cameraPose(from, 1)
        camera.position.copy(start.position)
        camera.quaternion.copy(start.quaternion)
        const transition = new CameraTransition()
        transition.begin(camera, cameraPose(to, 1), 0)
        for (let frame = 0; frame <= 85; frame++) {
          transition.update(camera, frame / 100)
          const car = new Vector3(0, 0.45, 0).sub(camera.position)
            .applyQuaternion(camera.quaternion.clone().invert())
          expect(car.z).toBeLessThan(-5)
          expect(Math.abs(car.x / car.z)).toBeLessThan(0.15)
          expect(Math.abs(car.y / car.z)).toBeLessThan(0.25)
        }
      }
    }
  })
  it('changes instantly for reduced motion', () => {
    const camera = new Camera()
    const transition = new CameraTransition()
    const target = cameraPose('reverse', 1)
    transition.begin(camera, target, 0, 0)
    transition.update(camera, 0)
    expect(transition.active).toBe(false)
    expect(camera.position.equals(target.position)).toBe(true)
  })
})
