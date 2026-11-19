// Inference from the four signals already decoded by tools/obd_poll.py.
// Receive timestamps use a local monotonic clock in milliseconds.
export type Sample<T> = { value: T; at: number; verified: boolean }
export type Gear = 'P' | 'R' | 'N' | 'D'
export type Signals = {
  speed: Sample<number>
  gear: Sample<Gear>
  rpm: Sample<number>
  batteryCurrent: Sample<number>
}
export type Snapshot = { connected: boolean; signals: Partial<Signals> }
export const LABELS = {
  offline: '차량 미연결', waiting: '정보 대기', checking: '상태 확인',
  stopped: '정차 중', stoppedEngine: '정차 · 엔진 회전', charging: '정차 충전',
  moving: '주행 중', engineOff: '엔진 정지 주행', engineRotating: '엔진 회전 주행',
  reverse: '후진 중', neutral: '중립 이동', decelerating: '감속 중',
  ev: 'EV 주행', engine: '엔진 주행', hybrid: '복합 주행', coast: '타력 주행',
  regen: '에너지 회수', chargingMoving: '주행 중 · 충전',
} as const
export type Status = keyof typeof LABELS
export type Motion = 'unknown' | 'stopped' | 'moving'
export type BatteryFlow = 'unknown' | 'low' | 'discharging' | 'charging'
export type Trend = 'unknown' | 'steady' | 'accelerating' | 'decelerating'
export type Facts = {
  motion: Motion
  gear: Gear | null
  engineRotating: boolean | null
  batteryFlow: BatteryFlow
  trend: Trend
  accelerationMps2: number | null
}
export type Result = {
  status: Status
  label: string
  inferred: boolean
  facts: Facts
  pending: Status | null
  evidence: (keyof Signals)[]
}
export const DEFAULT_POLICY = {
  maxAgeMs: 3000, maxSkewMs: 1500,
  confirmationMs: 700, confirmations: 2,
  stoppedKph: 0.5, movingKph: 2, inferenceMinKph: 5,
  // Provisional LF calibration: positive current = discharge, not road-verified yet.
  dischargeSign: 1 as 1 | -1,
  currentEnterA: 5, currentExitA: 3,
  trendMinMs: 750, trendWindowMs: 3000,
  trendDeltaKph: 2, trendAcceleration: 0.2,
}
export type Policy = typeof DEFAULT_POLICY
const inferredStatuses = new Set<Status>(['charging', 'ev', 'engine', 'hybrid', 'coast', 'regen', 'chargingMoving'])
const emptyFacts = (): Facts => ({ motion: 'unknown', gear: null, engineRotating: null,
  batteryFlow: 'unknown', trend: 'unknown', accelerationMps2: null })
const keys = ['speed', 'gear', 'rpm', 'batteryCurrent'] as const

export class DriveStatusMachine {
  private motion: Motion = 'unknown'
  private battery: BatteryFlow = 'unknown'
  private lastNow = -Infinity
  private watermarks = new Map<keyof Signals, number>()
  private speeds: { value: number; at: number }[] = []
  private previousGear: Gear | null = null
  private candidate: { status: Status; since: number; epoch: number; count: number } | null = null
  private settled: Status | null = null
  private policy: Policy

  constructor(policy: Partial<Policy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy }
    const p = this.policy
    if (Object.values(p).some(value => !Number.isFinite(value)) || p.stoppedKph >= p.movingKph ||
      p.currentExitA < 0 || p.currentEnterA <= p.currentExitA || ![1, -1].includes(p.dischargeSign) ||
      p.confirmations < 2 || p.maxAgeMs <= 0 || p.maxSkewMs < 0 || p.confirmationMs < 0 ||
      p.trendMinMs <= 0 || p.trendWindowMs < p.trendMinMs || p.trendDeltaKph <= 0 ||
      p.trendAcceleration <= 0 || p.inferenceMinKph < p.movingKph) throw new Error('Invalid drive-status policy')
  }

  update(snapshot: Snapshot, now: number): Result {
    if (!Number.isFinite(now) || now < this.lastNow) throw new Error('Time must be monotonic')
    this.lastNow = now
    const facts = emptyFacts()
    const read = <K extends keyof Signals>(key: K): Signals[K] | undefined => {
      const sample = snapshot.signals[key]
      if (!sample || !sample.verified || !Number.isFinite(sample.at) || sample.at > now ||
        now - sample.at > this.policy.maxAgeMs || sample.at < (this.watermarks.get(key) ?? -Infinity)) return
      if (key !== 'gear' && (!Number.isFinite(sample.value) ||
        (key !== 'batteryCurrent' && (sample.value as number) < 0))) return
      this.watermarks.set(key, sample.at)
      return sample as Signals[K]
    }
    const result = (status: Status, evidence: (keyof Signals)[], pending: Status | null = null): Result =>
      ({ status, label: LABELS[status], inferred: inferredStatuses.has(status), facts, evidence, pending })
    const reset = (status: Status) => {
      this.motion = 'unknown'; this.battery = 'unknown'; this.speeds = []; this.previousGear = null
      this.candidate = null; this.settled = null
      return result(status, [])
    }
    if (!snapshot.connected) {
      for (const key of keys) this.watermarks.set(key, now)
      return reset('offline')
    }
    const speed = read('speed'), gear = read('gear')
    if (!speed || !gear || !['P', 'R', 'N', 'D'].includes(gear.value) ||
      Math.abs(speed.at - gear.at) > this.policy.maxSkewMs) return reset('waiting')
    if (this.previousGear !== gear.value) {
      this.speeds = []; this.motion = 'unknown'; this.battery = 'unknown'
      this.candidate = null; this.settled = null
      this.previousGear = gear.value
    }
    facts.gear = gear.value
    this.motion = speed.value <= this.policy.stoppedKph ? 'stopped'
      : speed.value >= this.policy.movingKph ? 'moving' : this.motion
    facts.motion = this.motion
    // Only distinct speed packets contribute to the trend; a long gap starts a new window.
    const latest = this.speeds.at(-1)
    if (!latest || speed.at > latest.at) {
      if (latest && speed.at - latest.at > this.policy.trendWindowMs) this.speeds = []
      this.speeds.push({ value: speed.value, at: speed.at })
      this.speeds = this.speeds.filter(item => speed.at - item.at <= this.policy.trendWindowMs)
    }
    const baseline = this.speeds.find(item => speed.at - item.at >= this.policy.trendMinMs)
    if (baseline) {
      const change = speed.value - baseline.value
      const acceleration = change / 3.6 / ((speed.at - baseline.at) / 1000)
      facts.accelerationMps2 = acceleration
      facts.trend = Math.abs(change) < this.policy.trendDeltaKph || Math.abs(acceleration) < this.policy.trendAcceleration
        ? 'steady' : change < 0 ? 'decelerating' : 'accelerating'
    }
    const rpm = read('rpm'), current = read('batteryCurrent')
    const coherent = (...samples: { at: number }[]) => {
      const times = [speed.at, gear.at, ...samples.map(sample => sample.at)]
      return Math.max(...times) - Math.min(...times) <= this.policy.maxSkewMs
    }
    if (rpm && coherent(rpm)) facts.engineRotating = rpm.value > 0
    // Evaluate battery flow only when its timing is coherent with both engine and motion.
    if (current && rpm && facts.engineRotating !== null && coherent(rpm, current)) {
      const signed = current.value * this.policy.dischargeSign
      this.battery = signed >= this.policy.currentEnterA ? 'discharging'
        : signed <= -this.policy.currentEnterA ? 'charging'
        : this.battery === 'discharging' && signed > this.policy.currentExitA ? 'discharging'
        : this.battery === 'charging' && signed < -this.policy.currentExitA ? 'charging'
        : Math.abs(signed) <= this.policy.currentExitA ? 'low' : 'unknown'
    } else this.battery = 'unknown'
    facts.batteryFlow = this.battery
    const baseEvidence: (keyof Signals)[] = ['speed', 'gear']
    let fallback: Status = facts.motion === 'stopped' ? 'stopped' : facts.motion === 'unknown' ? 'waiting'
      : gear.value === 'R' ? 'reverse' : gear.value === 'N' ? 'neutral' : 'moving'
    if (gear.value === 'P' && facts.motion === 'moving') fallback = 'checking'
    else if (gear.value === 'D' && facts.motion !== 'unknown' && facts.engineRotating !== null) {
      baseEvidence.push('rpm')
      fallback = facts.motion === 'stopped' ? facts.engineRotating ? 'stoppedEngine' : 'stopped'
        : facts.trend === 'decelerating' ? 'decelerating' : facts.engineRotating ? 'engineRotating' : 'engineOff'
    }
    let status: Status = fallback
    // D only. Current polarity and cutoffs are calibration assumptions, so these are estimates.
    if (gear.value === 'D' && facts.engineRotating !== null && this.battery !== 'unknown') {
      if (facts.motion === 'stopped' && facts.engineRotating && this.battery === 'charging') status = 'charging'
      else if (facts.motion === 'moving' && speed.value >= this.policy.inferenceMinKph && facts.trend !== 'unknown') {
        if (this.battery === 'charging') status = !facts.engineRotating && facts.trend === 'decelerating' ? 'regen' : 'chargingMoving'
        else if (facts.trend !== 'decelerating') {
          if (this.battery === 'discharging') status = facts.engineRotating ? 'hybrid' : 'ev'
          else if (facts.engineRotating) status = 'engine'
          else if (facts.trend === 'steady') status = 'coast'
        }
      }
    }
    if (!inferredStatuses.has(status)) {
      this.candidate = null; this.settled = null
      return result(status, baseEvidence)
    }
    const evidence: (keyof Signals)[] = ['speed', 'gear', 'rpm', 'batteryCurrent']
    const epoch = Math.min(speed.at, gear.at, rpm!.at, current!.at)
    if (this.settled !== status) this.settled = null
    if (this.candidate?.status !== status) this.candidate = { status, since: now, epoch, count: 1 }
    else if (epoch > this.candidate.epoch) {
      this.candidate.epoch = epoch
      this.candidate.count++
      if (this.candidate.count >= this.policy.confirmations && now - this.candidate.since >= this.policy.confirmationMs) this.settled = status
    }
    return this.settled === status ? result(status, evidence) : result(fallback, baseEvidence, status)
  }
}
