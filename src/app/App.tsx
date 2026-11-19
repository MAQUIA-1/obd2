import { lazy, Suspense } from 'react'
import { DebugPanel } from '../features/debug/DebugPanel'
import { SceneBoundary } from '../features/vehicle-scene/SceneBoundary'
import { useDemo } from '../stores/demo'

const VehicleScene = lazy(() => import('../features/vehicle-scene/VehicleScene'))

export function App() {
  const view = useDemo((state) => state.view)
  const angle = useDemo((state) => state.steeringDeg)
  const speed = useDemo((state) => state.speedKph)
  const parked = view === 'park'
  const reversing = view === 'reverse'
  const gear = parked ? 'P' : reversing ? 'R' : view === 'neutral' ? 'N' : 'D'
  const metrics = reversing
    ? [{ label: '조향', value: `${angle > 0 ? '+' : ''}${angle.toFixed(0)}`, unit: '°' }]
    : [
        { label: '배터리', value: '55.5', unit: '%' },
        { label: '연료', value: '24.7', unit: '%' },
        parked ? { label: '외기온', value: '4', unit: '°C' } : { label: '엔진', value: '0', unit: 'rpm' },
      ]

  return (
    <main className="dashboard">
      <section className="instruments" aria-label={parked ? '주차 정보' : reversing ? '후진 정보' : '주행 정보'}>
        <div className="gear-strip" aria-label={`현재 기어 ${gear}, 데모`}>
          {['P', 'R', 'N', 'D'].map((item) => (
            <span key={item} className={item === gear ? 'selected' : ''}
              aria-current={item === gear ? 'true' : undefined}>{item}</span>
          ))}
        </div>
        <div className="primary-readout">
          {!parked && (
            <div className="speed" aria-label={reversing ? '후진 속도' : '속도'}>
              {speed.toFixed(0)}<span>km/h</span>
            </div>
          )}
        </div>
      </section>

      <section className="vehicle-stage" aria-label="차량 보기">
        <SceneBoundary>
          <Suspense fallback={<p className="scene-message">차량 불러오는 중</p>}>
            <VehicleScene />
          </Suspense>
        </SceneBoundary>
      </section>

      <section className={`vehicle-metrics${reversing ? ' vehicle-metrics--focused' : ''}`}
        aria-label={reversing ? '조향 정보' : '차량 정보, 데모 값'}>
        {metrics.map(({ label, value, unit }) => (
          <div className="metric" key={label}>
            <span className="metric-label">{label}</span>
            <output className="metric-value">{value}<span>{unit}</span></output>
          </div>
        ))}
      </section>

      <footer className="bottom-bar">
        <span className="connection-note">차량 미연결</span>
      </footer>
      <DebugPanel />
    </main>
  )
}
