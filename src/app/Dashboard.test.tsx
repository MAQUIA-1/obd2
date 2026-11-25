import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LABELS, type Status } from '../features/drive-status/state-machine'
import type { Gear, Readings } from '../features/obd/protocol'
import { Dashboard } from './Dashboard'

vi.mock('../features/vehicle-scene/VehicleScene', () => ({ default: () => null }))

function renderDashboard(gear: Gear | undefined, status: Status, batteryCurrentA?: number) {
  const readings: Partial<Readings> = { gear, batteryCurrentA }
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

describe('battery current display', () => {
  it.each([
    { current: -4.2, direction: 'charging', text: '-4.2' },
    { current: 8.1, direction: 'discharging', text: '+8.1' },
  ])('shows $direction with the signed current', ({ current, direction, text }) => {
    const html = renderDashboard('D', 'waiting', current)
    expect(html).toContain(`data-current-direction="${direction}">${text}<span>A</span>`)
  })

  it.each([{ current: 0, text: '0.0' }, { current: undefined, text: '—' }])(
    'uses the neutral style for $text', ({ current, text }) => {
      const html = renderDashboard('D', 'waiting', current)
      expect(html).not.toContain('data-current-direction')
      expect(html).toContain(`aria-label="HV 배터리 전류">${text}<span>A</span>`)
    },
  )
})
