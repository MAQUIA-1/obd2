import { Dashboard } from '../../app/Dashboard'
import { useDemo } from './demo-store'
import { demoActivity } from './demo-scenarios'
import { useDemoDriveStatus } from './use-demo-drive-status'
import type { Readings } from '../obd/protocol'
import { DEMO_READINGS } from './demo-readings'
import { DebugPanel } from './DebugPanel'
import './debug.css'

const gears = { park: 'P', reverse: 'R', neutral: 'N', drive: 'D' } as const

export default function PreviewDashboard({ onExit }: { onExit: () => void }) {
  const input = useDemo()
  const status = useDemoDriveStatus()
  const fields: Partial<Readings> = {
    ...DEMO_READINGS,
    ...demoActivity(input),
    gear: gears[input.view],
    speedKph: input.speedKph,
    steeringAngleDeg: input.steeringDeg,
  }

  return (
    <Dashboard
      read={key => fields[key]}
      status={status}
      footer={
        <>
          <span className="connection-note" role="status">개발용 미리보기</span>
          <div className="connection-actions preview-actions">
            <button type="button" onClick={onExit}>미리보기 종료</button>
          </div>
        </>
      }
      tools={<DebugPanel />}
    />
  )
}
