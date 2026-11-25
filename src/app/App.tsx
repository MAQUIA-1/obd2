import { lazy, Suspense, useState } from 'react'
import { useVehicle } from '../features/obd/use-vehicle'
import { Dashboard } from './Dashboard'

const PreviewDashboard = import.meta.env.DEV
  ? lazy(() => import('../features/debug/PreviewDashboard'))
  : null
const DebugPanel = import.meta.env.DEV
  ? lazy(() => import('../features/debug/DebugPanel'))
  : null

export function App() {
  const vehicle = useVehicle()
  const [preview, setPreview] = useState(false)
  const [night, setNight] = useState(false)
  const theme = { night, onToggleTheme: () => setNight(current => !current) }
  const busy = vehicle.phase === 'selecting' || vehicle.phase === 'closing'
  const sessionOpen = vehicle.phase === 'connecting' || vehicle.phase === 'connected'

  const liveDashboard = (
    <Dashboard
      {...theme}
      read={vehicle.read}
      status={vehicle.status}
      footer={
        <>
          <span className="connection-note" role="status">
            {vehicle.supported ? vehicle.message : '차량 연결은 Android Chrome의 HTTPS 페이지에서 사용할 수 있습니다.'}
          </span>
          <div className="connection-actions">
            {sessionOpen ? (
              <button type="button" onClick={vehicle.disconnect}>연결 해제</button>
            ) : (
              <button type="button" className="connect-button" disabled={busy || !vehicle.supported}
                onClick={() => void vehicle.connect()}>
                {busy ? '처리 중' : vehicle.phase === 'error' ? '다시 연결' : '차량 연결'}
              </button>
            )}
          </div>
        </>
      }
    />
  )

  return (
    <>
      {PreviewDashboard && preview
        ? (
            <Suspense fallback={<Dashboard {...theme} read={vehicle.read} status={vehicle.status} footer={null} />}>
              <PreviewDashboard {...theme} />
            </Suspense>
          )
        : liveDashboard}
      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel preview={preview} canStart={!busy && !sessionOpen} onTogglePreview={() => setPreview(active => !active)} />
        </Suspense>
      )}
    </>
  )
}
