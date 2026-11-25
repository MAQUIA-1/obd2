import { lazy, Suspense, type ReactNode } from 'react'
import { LABELS, type Status } from '../features/drive-status/state-machine'
import type { Gear, Readings } from '../features/obd/protocol'
import type { ViewMode } from '../features/vehicle-scene/camera-transition'
import { SceneBoundary } from '../features/vehicle-scene/SceneBoundary'

const VehicleScene = lazy(() => import('../features/vehicle-scene/VehicleScene'))
const modes: Record<Gear, ViewMode> = { P: 'park', R: 'reverse', N: 'neutral', D: 'drive', M: 'drive' }
const format = (value: number | undefined, digits = 0) => value?.toFixed(digits) ?? '—'

type DashboardProps = {
  read: <K extends keyof Readings>(key: K) => Readings[K] | undefined
  status: Status
  footer: ReactNode
  tools?: ReactNode
}

export function Dashboard({ read, status, footer, tools }: DashboardProps) {
  const gear = read('gear')
  const view = gear && modes[gear]
  const parked = view === 'park'
  const reversing = view === 'reverse'
  const driving = view === 'drive' || view === 'neutral'
  const angle = read('steeringAngleDeg')
  const speed = read('speedKph')
  const rpm = read('rpm')
  const current = read('batteryCurrentA')
  const ambient = read('outsideTempC')
  const fuel = read('fuelPct')
  const soc = read('batterySocPct')
  const coolant = read('coolantTempC')
  const displayedGears = gear === 'M' ? ['P', 'R', 'N', 'M'] : ['P', 'R', 'N', 'D']

  return (
    <main className="dashboard">
      <section className="instruments" aria-label={parked ? '주차 정보' : reversing ? '후진 정보' : '계기판'}>
        <div className="gear-strip" aria-label={gear ? `현재 기어 ${gear}` : '기어 정보 없음'}>
          {displayedGears.map(item => (
            <span key={item} className={item === gear ? 'selected' : ''}
              aria-current={item === gear ? 'true' : undefined}>{item}</span>
          ))}
        </div>
        {driving && (
          <p className="drive-status" role="status" data-state={status}>{LABELS[status]}</p>
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

      <footer className="bottom-bar">{footer}</footer>
      {tools}
    </main>
  )
}
