import { Dashboard, type DashboardTheme } from '../../app/Dashboard'
import { useDemo } from './demo-store'
import { demoActivity } from './demo-scenarios'
import { useDemoDriveStatus } from './use-demo-drive-status'
import type { Readings } from '../obd/protocol'
import { DEMO_READINGS } from './demo-readings'

const gears = { park: 'P', reverse: 'R', neutral: 'N', drive: 'D' } as const

export default function PreviewDashboard(theme: DashboardTheme) {
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
      {...theme}
      read={key => fields[key]}
      status={status}
      footer={<span className="connection-note" role="status">개발용 미리보기</span>}
    />
  )
}
