import { lazy, Suspense, useState } from 'react'
import { useVehicle } from '../features/obd/use-vehicle'
import { Dashboard } from './Dashboard'

const PreviewDashboard = import.meta.env.DEV
  ? lazy(() => import('../features/debug/PreviewDashboard'))
  : null

export function App() {
  const vehicle = useVehicle()
  const [preview, setPreview] = useState(false)
  const busy = vehicle.phase === 'selecting' || vehicle.phase === 'closing'
  const sessionOpen = vehicle.phase === 'connecting' || vehicle.phase === 'connected'

  if (PreviewDashboard && preview) {
    return (
      <Suspense fallback={<Dashboard read={vehicle.read} status={vehicle.status} footer={null} />}>
        <PreviewDashboard onExit={() => setPreview(false)} />
      </Suspense>
    )
  }

  return (
    <Dashboard
      read={vehicle.read}
      status={vehicle.status}
      footer={
        <>
          <span className="connection-note" role="status">
            {vehicle.supported ? vehicle.message : '차량 연결은 Android Chrome의 HTTPS 페이지에서 사용할 수 있습니다.'}
          </span>
          <div className="connection-actions">
            {PreviewDashboard && !busy && !sessionOpen && (
              <button type="button" onClick={() => setPreview(true)}>화면 미리보기</button>
            )}
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
}
