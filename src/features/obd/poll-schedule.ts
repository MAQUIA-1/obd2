import { FAST_READING_MAX_AGE_MS, tasks, type Gear } from './protocol'

type ScheduledPoll = { name: keyof typeof tasks; due: number }

const REVERSE_STEERING_INTERVAL_MS = 300

export function createPollSchedule() {
  const steering: ScheduledPoll = { name: 'steering', due: 0 }
  const polls = (Object.keys(tasks) as ScheduledPoll['name'][]).map(name =>
    name === 'steering' ? steering : { name, due: 0 })
  let lastCompleted: ScheduledPoll | undefined
  let lastSteeringAt: number | undefined
  let reverseGearAt: number | undefined

  function leaveReverse() {
    reverseGearAt = undefined
    steering.due = lastSteeringAt === undefined ? 0 : lastSteeringAt + tasks.steering.interval
  }

  function expireReverse(at: number) {
    if (reverseGearAt !== undefined && at - reverseGearAt > FAST_READING_MAX_AGE_MS) leaveReverse()
  }

  return {
    next(at: number) {
      expireReverse(at)
      // Give overdue regular requests a turn between prioritized steering reads.
      if (reverseGearAt !== undefined && steering.due <= at && lastCompleted !== steering) return steering
      return polls.reduce((earliest, poll) => poll.due < earliest.due ? poll : earliest)
    },

    complete(poll: ScheduledPoll, at: number, gear?: Gear) {
      expireReverse(at)
      lastCompleted = poll
      if (poll === steering) lastSteeringAt = at
      const interval = poll === steering && reverseGearAt !== undefined
        ? REVERSE_STEERING_INTERVAL_MS
        : tasks[poll.name].interval
      poll.due = at + interval

      if (gear === 'R') {
        if (reverseGearAt === undefined) steering.due = at
        reverseGearAt = at
      } else if (gear !== undefined && reverseGearAt !== undefined) {
        leaveReverse()
      }
    },
  }
}
