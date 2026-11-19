import { Camera, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { ViewMode } from '../../stores/demo'

// Small screen-left aim offset balances the silhouette in the diagonal park view.
const PARK_TARGET = new Vector3(0.16, 0.45, -0.11)

export function cameraPose(view: ViewMode, scale: number) {
  const position = new Vector3()
  const quaternion = new Quaternion()
  if (view === 'reverse') {
    position.set(0, 15.5 * scale, 1.65)
    // Exact overhead orientation avoids lookAt's singularity and late yaw flip.
    quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0))
  } else {
    const target = new Vector3()
    if (view === 'park') {
      position.set(-5 * scale, 3.6 * scale, -7 * scale)
      target.copy(PARK_TARGET)
    } else {
      position.set(0, 4.8 * scale, 9 * scale)
      target.set(0, 0, -2)
    }
    quaternion.setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)))
  }
  const target = view === 'reverse' ? new Vector3(0, 0, 1.65)
    : view === 'park' ? PARK_TARGET.clone() : new Vector3(0, 0, -2)
  return { position, quaternion, target }
}

export class CameraTransition {
  active = false
  private fromPosition = new Vector3()
  private fromRotation = new Quaternion()
  private fromTarget = new Vector3()
  private fromRadius = 1
  private destination = cameraPose('park', 1)
  private started = 0
  private duration = 0.85

  begin(camera: Camera, destination: ReturnType<typeof cameraPose>, time: number, duration = 0.85) {
    this.fromPosition.copy(camera.position)
    this.fromRotation.copy(camera.quaternion)
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    this.fromRadius = Math.max(0.1, new Vector3(0, 0.45, 0).sub(camera.position).dot(forward))
    this.fromTarget.copy(camera.position).addScaledVector(forward, this.fromRadius)
    this.destination = destination
    this.started = time
    this.duration = duration
    this.active = true
  }

  update(camera: Camera, time: number) {
    if (!this.active) return
    const progress = this.duration <= 0 ? 1 : Math.min(1, Math.max(0, (time - this.started) / this.duration))
    const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10)
    if (progress === 0) {
      camera.position.copy(this.fromPosition)
      camera.quaternion.copy(this.fromRotation)
      return
    }
    const target = new Vector3().lerpVectors(this.fromTarget, this.destination.target, eased)
    const endRadius = this.destination.position.distanceTo(this.destination.target)
    // Couple position to the viewing direction, including at the overhead pole.
    const radius = this.fromRadius + (endRadius - this.fromRadius) * eased
    camera.quaternion.slerpQuaternions(this.fromRotation, this.destination.quaternion, eased)
    camera.position.set(0, 0, radius).applyQuaternion(camera.quaternion).add(target)
    if (progress === 1) {
      camera.position.copy(this.destination.position)
      camera.quaternion.copy(this.destination.quaternion)
      this.active = false
    }
  }
}
