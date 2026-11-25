import { describe, expect, it } from 'vitest'
import { createPollSchedule } from './poll-schedule'
import type { Gear } from './protocol'

function readInitialGear(gear: Gear) {
  const schedule = createPollSchedule()
  schedule.complete(schedule.next(0), 50) // Speed
  schedule.complete(schedule.next(50), 100) // RPM
  const gearPoll = schedule.next(100)
  expect(gearPoll.name).toBe('gear')
  schedule.complete(gearPoll, 150, gear)
  return { schedule, gearPoll }
}

describe('reverse steering polling', () => {
  it('keeps the normal order and steering interval in D', () => {
    const { schedule } = readInitialGear('D')
    const bms = schedule.next(150)
    expect(bms.name).toBe('bms')
    schedule.complete(bms, 200)
    const steering = schedule.next(200)
    expect(steering.name).toBe('steering')
    schedule.complete(steering, 250)
    expect(steering.due).toBe(950)
  })

  it('prioritizes steering immediately in R and again after its shorter interval', () => {
    const { schedule } = readInitialGear('R')
    const steering = schedule.next(150)
    expect(steering).toEqual({ name: 'steering', due: 150 })
    schedule.complete(steering, 200)
    expect(steering.due).toBe(500)

    const bms = schedule.next(500)
    expect(bms.name).toBe('bms')
    schedule.complete(bms, 550)
    expect(schedule.next(550)).toBe(steering)
  })

  it('does not restart the steering interval on repeated R readings', () => {
    const { schedule, gearPoll } = readInitialGear('R')
    const steering = schedule.next(150)
    schedule.complete(steering, 200)
    schedule.complete(gearPoll, 400, 'R')
    expect(steering.due).toBe(500)
  })

  it('restores the normal steering interval when the selector leaves R', () => {
    const { schedule, gearPoll } = readInitialGear('R')
    const steering = schedule.next(150)
    schedule.complete(steering, 200)
    schedule.complete(gearPoll, 350, 'N')
    expect(steering.due).toBe(900)
    expect(schedule.next(500).name).toBe('bms')
  })

  it('stops prioritizing steering after the last R sample expires', () => {
    const { schedule, gearPoll } = readInitialGear('R')
    const steering = schedule.next(150)
    schedule.complete(steering, 3100)
    schedule.complete(gearPoll, 3110) // An invalid reply does not refresh the gear.
    expect(steering.due).toBe(3400)
    expect(schedule.next(3151).name).toBe('bms')
    expect(steering.due).toBe(3800)
  })
})
