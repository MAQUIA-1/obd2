import { Fragment, Suspense, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Line, Outlines, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Mesh, Quaternion, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import modelUrl from '../../../design/models/sonata-lf/sonata15.glb?url'
import { useDemo } from '../../stores/demo'
import { steeringGuide } from './steering-guide'
import { displayMaterial } from './model-materials'
import { MovingGround } from './MovingGround'
import { cameraPose, CameraTransition } from './camera-transition'
import { frontWheelAngle, MODEL_SCALE_X, MODEL_SCALE_Z } from './vehicle-motion'

function Sonata() {
  const { scene } = useGLTF(modelUrl)
  const model = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const copies = materials.map(displayMaterial)
      object.material = Array.isArray(object.material) ? copies : copies[0]
    })
    return copy
  }, [scene])
  const outlineMeshes = useMemo(() => {
    const meshes: Mesh[] = []
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some((material) => material.name.includes('body'))) meshes.push(object)
    })
    return meshes
  }, [model])
  const wheels = useMemo(() => {
    const front: { wheel: Mesh; rest: Quaternion }[] = []
    model.traverse((wheel) => {
      if (wheel instanceof Mesh && wheel.name.startsWith('tire') && wheel.position.z < 0) {
        front.push({ wheel, rest: wheel.quaternion.clone() })
      }
    })
    return front
  }, [model])
  const rotation = useMemo(() => new Quaternion(), [])
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  useFrame(() => {
    const steering = useDemo.getState().steeringDeg
    for (const { wheel, rest } of wheels) {
      const angle = frontWheelAngle(steering, wheel.position.x < 0 ? -1 : 1)
      wheel.quaternion.copy(rest).premultiply(rotation.setFromAxisAngle(up, -angle))
    }
  })
  return (
    <>
      <primitive object={model} scale={[MODEL_SCALE_X, MODEL_SCALE_Z, MODEL_SCALE_Z]} dispose={null} />
      {outlineMeshes.map((mesh) => (
        <Fragment key={mesh.uuid}>
          {createPortal(
            <Outlines thickness={0.65} color="#737e88" opacity={0.4} transparent toneMapped={false} />,
            mesh,
          )}
        </Fragment>
      ))}
    </>
  )
}

function CameraRig() {
  const view = useDemo((state) => state.view)
  const reduceMotion = useReducedMotion()
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controlsRef.current = controls
    controls.target.copy(cameraPose('park', 1).target)
    controls.enablePan = false
    controls.enableZoom = false
    controls.enableDamping = false
    controls.minPolarAngle = 0.65
    controls.maxPolarAngle = 1.38
    controls.enabled = false
    return () => controls.dispose()
  }, [camera, gl])
  const previous = useRef('')
  const transition = useRef(new CameraTransition())

  useFrame(({ camera, size, gl }) => {
    const scale = Math.max(1, 0.8 / (size.width / size.height))
    const key = `${view}:${scale}:${reduceMotion}`
    const now = performance.now() / 1000
    if (previous.current !== key) {
      const firstFrame = previous.current === ''
      previous.current = key
      transition.current.begin(camera, cameraPose(view, scale), now, firstFrame || reduceMotion ? 0 : 0.85)
    }
    transition.current.update(camera, now)
    // Keep the driving views fixed after completing the transition.
    if (view !== 'park' && !transition.current.active) {
      const pose = cameraPose(view, scale)
      camera.position.copy(pose.position)
      camera.quaternion.copy(pose.quaternion)
    }
    const controls = controlsRef.current
    if (controls) {
      controls.enabled = view === 'park' && !transition.current.active
      if (controls.enabled) controls.update()
    }
    gl.domElement.dataset.cameraMode = view
    gl.domElement.dataset.cameraTransitioning = String(transition.current.active)
  })

  return null
}

function Guide() {
  const angle = useDemo((state) => state.steeringDeg)
  const view = useDemo((state) => state.view)
  const left = useMemo(() => steeringGuide(angle, -1), [angle])
  const right = useMemo(() => steeringGuide(angle, 1), [angle])
  if (view !== 'reverse') return null
  return (
    <group>
      <Line points={left} color="#8b959f" lineWidth={1.4} dashed dashSize={0.17} gapSize={0.14} />
      <Line points={right} color="#8b959f" lineWidth={1.4} dashed dashSize={0.17} gapSize={0.14} />
    </group>
  )
}

export default function VehicleScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, toneMappingExposure: 1.3 }}
      fallback={<p className="scene-message">이 브라우저에서 3D 화면을 사용할 수 없습니다.</p>}
      aria-label="쏘나타 차량과 조향 방향 가이드"
    >
      <color attach="background" args={['#ffffff']} />
      <PerspectiveCamera makeDefault position={[-5, 3.6, -7]} fov={35} near={0.1} far={100} />
      <CameraRig />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-3, 8, -4]} intensity={1.8} />
      <directionalLight position={[4, 5, 3]} intensity={0.9} />
      <Suspense fallback={null}>
        <Sonata />
        <ContactShadows position={[0, -0.015, 0]} opacity={0.14} scale={8}
          blur={4} far={2} resolution={256} frames={1} color="#6e747a" />
      </Suspense>
      <MovingGround />
      <Guide />
    </Canvas>
  )
}
