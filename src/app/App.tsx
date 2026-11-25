import { lazy, Suspense } from 'react'
import { DebugPanel } from '../features/debug/DebugPanel'
import { SceneBoundary } from '../features/vehicle-scene/SceneBoundary'
import { useDemo, type ViewMode } from '../stores/demo'
import { useDemoDriveStatus } from '../features/drive-status/use-demo-drive-status'
import { demoActivity } from '../features/drive-status/demo-scenarios'
import { DEMO_READINGS } from '../features/vehicle-info/demo-readings'
import { useVehicle } from '../features/obd/use-vehicle'
import type { Gear } from '../features/obd/protocol'

const VehicleScene = lazy(() => import('../features/vehicle-scene/VehicleScene'))
const modes: Record<Gear, ViewMode> = { P: 'park', R: 'reverse', N: 'neutral', D: 'drive', M: 'drive' }
const gears: Record<ViewMode, Gear> = { park: 'P', reverse: 'R', neutral: 'N', drive: 'D' }
const format = (value: number | undefined, digits = 0) => value?.toFixed(digits) ?? '—'

export function App() {
  const demoView = useDemo(state => state.view)
  const demoAngle = useDemo(state => state.steeringDeg)
  const demoSpeed = useDemo(state => state.speedKph)
  const scenario = useDemo(state => state.scenario)
  const activity = demoActivity({ view: demoView, speedKph: demoSpeed, scenario })
  const vehicle = useVehicle()
  const demo = vehicle.phase === 'demo'
  const demoStatus = useDemoDriveStatus(demo)
  const gear = demo ? gears[demoView] : vehicle.read('gear')
  const view = gear && modes[gear]
  const parked = view === 'park'
  const reversing = view === 'reverse'
  const driving = view === 'drive' || view === 'neutral'
  const busy = vehicle.phase === 'selecting' || vehicle.phase === 'closing'
  const sessionOpen = vehicle.phase === 'connecting' || vehicle.phase === 'connected'
  const angle = demo ? demoAngle : vehicle.read('steeringAngleDeg')
  const speed = demo ? demoSpeed : vehicle.read('speedKph')
  const rpm = demo ? activity.rpm : vehicle.read('rpm')
  const current = demo ? activity.batteryCurrentA : vehicle.read('batteryCurrentA')
  const ambient = demo ? DEMO_READINGS.outsideTempC : vehicle.read('outsideTempC')
  const fuel = demo ? DEMO_READINGS.fuelPct : vehicle.read('fuelPct')
  const soc = demo ? DEMO_READINGS.batterySocPct : vehicle.read('batterySocPct')
  const coolant = demo ? DEMO_READINGS.coolantTempC : vehicle.read('coolantTempC')
  const status = demo ? demoStatus.status : vehicle.status
  const statusLabel = demo ? demoStatus.label : vehicle.statusLabel
  const displayedGears = gear === 'M' ? ['P', 'R', 'N', 'M'] : ['P', 'R', 'N', 'D']

  return (
    <main className="dashboard">
      <section className="instruments" aria-label={parked ? '주차 정보' : reversing ? '후진 정보' : '주행 정보'}>
        <div className="gear-strip" aria-label={gear ? `현재 기어 ${gear}${demo ? ', 데모' : ''}` : '기어 정보 없음'}>
          {displayedGears.map(item => (
            <span key={item} className={item === gear ? 'selected' : ''}
              aria-current={item === gear ? 'true' : undefined}>{item}</span>
          ))}
        </div>
        {driving && (
          <p className="drive-status" role="status" data-state={status}>{statusLabel}</p>
        )}
        <div className="primary-readout">
          {!parked && (
            <div className="speed" aria-label={reversing ? '후진 속도' : '속도'}>
              {format(speed)}<span>km/h</span>
            </div>
          )}
          {!parked && !reversing && (
            <div className="activity-group" aria-label="회전수와 전류">
              <output aria-label="엔진 회전수">{format(rpm)}<span>rpm</span></output>
              <output aria-label="HV 배터리 전류">{format(current, 1)}<span>A</span></output>
            </div>
          )}
        </div>
        {driving && (
          <div className="ambient-summary" aria-label="외기온">
            <output>{format(ambient)}<span>°C</span></output>
          </div>
        )}
      </section>

      <section className="vehicle-stage" aria-label="차량 보기">
        <SceneBoundary>
          <Suspense fallback={<p className="scene-message">차량 불러오는 중</p>}>
            <VehicleScene view={view ?? 'park'} speed={view ? speed : undefined} steering={angle} />
          </Suspense>
        </SceneBoundary>
      </section>

      <section className={`telemetry-groups${reversing ? ' telemetry-groups--reverse' : ' telemetry-groups--summary'}`}
        aria-label={reversing ? '조향 정보' : '차량 정보'}>
        {reversing ? (
          <div className="telemetry-group steering-group">
            <h2>조향</h2>
            <output className="group-value">{angle !== undefined && angle > 0 ? '+' : ''}{format(angle)}<span>°</span></output>
          </div>
        ) : (
          [
            { label: '연료', value: format(fuel, 1), unit: '%' },
            { label: '배터리', value: format(soc, 1), unit: '%' },
            parked
              ? { label: '외기온', value: format(ambient), unit: '°C' }
              : { label: '냉각수온', value: format(coolant), unit: '°C' },
          ].map(({ label, value, unit }) => (
            <div className="telemetry-group" key={label}>
              <h2>{label}</h2>
              <output className="group-value">{value}<span>{unit}</span></output>
            </div>
          ))
        )}
      </section>

      <footer className={`bottom-bar${demo ? ' bottom-bar--demo' : ''}`}>
        <span className="connection-note" role="status">
          {vehicle.supported ? vehicle.message : '데모 · 연결은 HTTPS의 Android Chrome에서 지원됩니다.'}
        </span>
        <div className="connection-actions">
          {!demo && !busy && !sessionOpen && <button type="button" onClick={vehicle.demo}>데모</button>}
          {sessionOpen ? (
            <button type="button" onClick={vehicle.disconnect}>연결 해제</button>
          ) : (
            <button type="button" disabled={busy || !vehicle.supported} onClick={() => void vehicle.connect()}>
              {demo ? '차량 연결' : busy ? '처리 중' : '다시 연결'}
            </button>
          )}
        </div>
      </footer>
      {demo && <DebugPanel />}
    </main>
  )
}
