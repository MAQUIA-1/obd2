import { lazy, Suspense } from 'react'
import { DebugPanel } from '../features/debug/DebugPanel'
import { SceneBoundary } from '../features/vehicle-scene/SceneBoundary'
import { useDemo } from '../stores/demo'
import { DEMO_READINGS } from '../features/vehicle-info/demo-readings'

const VehicleScene = lazy(() => import('../features/vehicle-scene/VehicleScene'))

export function App() {
  const view = useDemo((state) => state.view)
  const angle = useDemo((state) => state.steeringDeg)
  const speed = useDemo((state) => state.speedKph)
  const parked = view === 'park'
  const reversing = view === 'reverse'
  const gear = parked ? 'P' : reversing ? 'R' : view === 'neutral' ? 'N' : 'D'

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
          {!parked && !reversing && (
            <div className="activity-group" aria-label="회전수와 전류, 데모 값">
              <output aria-label="엔진 회전수">{DEMO_READINGS.rpm.toFixed(0)}<span>rpm</span></output>
              <output aria-label="HV 배터리 전류">{DEMO_READINGS.batteryCurrentA.toFixed(1)}<span>A</span></output>
            </div>
          )}
        </div>
        {!parked && !reversing && (
          <div className="ambient-summary" aria-label="외기온, 데모 값">
            <output>{DEMO_READINGS.outsideTempC.toFixed(0)}<span>°C</span></output>
          </div>
        )}
      </section>

      <section className="vehicle-stage" aria-label="차량 보기">
        <SceneBoundary>
          <Suspense fallback={<p className="scene-message">차량 불러오는 중</p>}>
            <VehicleScene />
          </Suspense>
        </SceneBoundary>
      </section>

      <section className={`telemetry-groups${reversing ? ' telemetry-groups--reverse' : ' telemetry-groups--summary'}`}
        aria-label={reversing ? '조향 정보' : '차량 정보, 데모 값'}>
        {reversing ? (
          <div className="telemetry-group steering-group">
            <h2>조향</h2>
            <output className="group-value">{angle > 0 ? '+' : ''}{angle.toFixed(0)}<span>°</span></output>
          </div>
        ) : (
          [
            { label: '연료', value: DEMO_READINGS.fuelPct.toFixed(1), unit: '%' },
            { label: '배터리', value: DEMO_READINGS.batterySocPct.toFixed(1), unit: '%' },
            parked
              ? { label: '외기온', value: DEMO_READINGS.outsideTempC.toFixed(0), unit: '°C' }
              : { label: '냉각수온', value: DEMO_READINGS.coolantTempC.toFixed(0), unit: '°C' },
          ].map(({ label, value, unit }) => (
            <div className="telemetry-group" key={label}>
              <h2>{label}</h2>
              <output className="group-value">{value}<span>{unit}</span></output>
            </div>
          ))
        )}
      </section>

      <footer className="bottom-bar">
        <span className="connection-note">차량 미연결 · 데모</span>
      </footer>
      <DebugPanel />
    </main>
  )
}
