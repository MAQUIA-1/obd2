import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ShaderMaterial, Vector2 } from 'three'
import { useReducedMotion } from 'motion/react'
import type { ViewMode } from '../../stores/demo'
import { advanceGroundPose, groundVelocity } from './ground-motion'
import { REAR_AXLE_Z, steeringCurvature } from './vehicle-motion'

export function MovingGround({ view, speed, steering }: { view: ViewMode; speed: number; steering: number }) {
  const material = useRef<ShaderMaterial>(null)
  const reducedMotion = useReducedMotion()
  const pose = useRef({ x: 0, z: 0, heading: 0 })
  const uniforms = useMemo(() => ({ offset: { value: new Vector2() }, heading: { value: 0 }, intensity: { value: 0.20 }, rearAxle: { value: REAR_AXLE_Z }, forwardView: { value: 0 } }), [])
  useFrame((_, delta) => {
    const velocity = reducedMotion ? 0 : groundVelocity(speed, view)
    if (material.current) {
      pose.current = advanceGroundPose(pose.current, velocity, steeringCurvature(steering), delta)
      material.current.uniforms.offset.value.set(pose.current.x, pose.current.z)
      material.current.uniforms.heading.value = pose.current.heading
      const forwardView = material.current.uniforms.forwardView
      forwardView.value += ((view === 'drive' || view === 'neutral' ? 1 : 0) - forwardView.value) * (1 - Math.exp(-delta * 4))
      const intensity = material.current.uniforms.intensity
      intensity.value += ((view === 'park' ? 0.20 : 0.38) - intensity.value) * (1 - Math.exp(-delta * 4))
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[60, 60]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          varying vec2 ground;
          void main() {
            ground = vec2(position.x, -position.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec2 offset;
          uniform float heading;
          uniform float rearAxle;
          uniform float intensity;
          uniform float forwardView;
          varying vec2 ground;
          void main() {
            vec2 spacing = vec2(1.2);
            float c = cos(heading);
            float s = sin(heading);
            vec2 local = ground - vec2(0.0, rearAxle);
            vec2 position = vec2(c * local.x - s * local.y, s * local.x + c * local.y) + offset;

            vec2 cell = abs(fract(position / spacing + 0.5) - 0.5) * spacing;
            vec2 aa = max(fwidth(position), vec2(0.002));
            vec2 lines = 1.0 - smoothstep(vec2(0.007), vec2(0.007) + aa, cell);
            vec2 arms = 1.0 - smoothstep(vec2(0.10), vec2(0.10) + aa, cell);
            float cross = max(lines.x * arms.y, lines.y * arms.x);
            // Extend visibility toward the vehicle front (-Z), keeping the rear fade local.
            float forward = smoothstep(0.0, 4.0, -ground.y);
            float reach = 1.0 + 2.0 * forwardView * forward;
            float fade = 1.0 - smoothstep(1.5, 8.0, length(vec2(ground.x, ground.y / reach)));
            gl_FragColor = vec4(vec3(0.65, 0.69, 0.73), cross * fade * intensity);

          }
        `}
      />
    </mesh>
  )
}
