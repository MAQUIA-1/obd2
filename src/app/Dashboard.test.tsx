import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LABELS, type Status } from '../features/drive-status/state-machine'
import type { Gear, Readings } from '../features/obd/protocol'
import { Dashboard } from './Dashboard'

vi.mock('../features/vehicle-scene/VehicleScene', () => ({ default: () => null }))

function renderDashboard(gear: Gear | undefined, status: Status) {
  const readings: Partial<Readings> = { gear }
  return renderToStaticMarkup(<Dashboard read={key => readings[key]} status={status} footer={null} />)
}

describe('central drive mode display', () => {
  const visible: Status[] = ['ev', 'engine', 'hybrid', 'coast']
  const hidden = (Object.keys(LABELS) as Status[]).filter(status => !visible.includes(status))

  it.each(visible)('shows %s in D', status => {
    const html = renderDashboard('D', status)
    expect(html).toContain(`data-state="${status}"`)
    expect(html).toContain(LABELS[status])
  })

  it.each(hidden)('leaves the center blank for %s in D', status => {
    expect(renderDashboard('D', status)).not.toContain('class="drive-status"')
  })

  it.each(['P', 'R', 'N', 'M', undefined] as const)('requires D rather than %s', gear => {
    expect(renderDashboard(gear, 'ev')).not.toContain('class="drive-status"')
  })
})
