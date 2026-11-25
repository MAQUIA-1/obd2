import { useEffect, useRef, useState } from 'react'
import { DriveStatusMachine, type Snapshot, type Status } from '../drive-status/state-machine'
import { smoothFuelPct } from './fuel-level'
import { pollVehicle, SPP } from './session'
import { FAST_READING_MAX_AGE_MS, type Readings } from './protocol'

type Samples = { [K in keyof Readings]?: { value: Readings[K]; at: number; verified: true } }
type Connection = 'idle' | 'selecting' | 'connecting' | 'connected' | 'closing' | 'disconnected' | 'error'
type VehicleState = { phase: Connection; message: string; samples: Samples; now: number; status: Status }

const initial: VehicleState = { phase: 'idle', message: '차량 미연결', samples: {}, now: 0, status: 'waiting' }
const SLOW_READING_MAX_AGE_MS = 25_000
const slow = new Set<keyof Readings>(['fuelPct', 'coolantTempC', 'controlVoltageV', 'outsideTempC'])
const notes = {
  selecting: '페어링한 OBD 어댑터를 선택하세요.',
  connecting: '차량 응답을 기다리는 중',
  connected: '차량 연결됨',
  closing: '연결 해제 중',
  disconnected: '차량 연결 해제됨',
}

export function useVehicle() {
  const [state, setState] = useState(initial)
  const active = useRef<AbortController | null>(null)

  useEffect(() => () => active.current?.abort(), [])

  async function connect() {
    if (active.current || !navigator.serial) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    let samples: Samples = {}
    let ticker: ReturnType<typeof setInterval> | undefined
    const machine = new DriveStatusMachine()
    const update = (now: number) => {
      if (signal.aborted) return
      const snapshot: Snapshot = { connected: true, signals: {
        speed: samples.speedKph,
        gear: samples.gear?.value === 'M' ? undefined : samples.gear as Snapshot['signals']['gear'],
        rpm: samples.rpm,
        batteryCurrent: samples.batteryCurrentA,
      } }
      const status = machine.update(snapshot, now).status
      setState({ phase: 'connected', message: notes.connected, samples, now, status })
    }

    setState({ ...initial, phase: 'selecting', message: notes.selecting })
    let selected = false
    try {
      const port = await navigator.serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP }] })
      selected = true
      signal.throwIfAborted()
      setState({ ...initial, phase: 'connecting', message: notes.connecting })
      await pollVehicle(port, signal, (values, at) => {
        const { fuelPct } = values
        const filtered = fuelPct === undefined ? values : {
          ...values,
          fuelPct: smoothFuelPct(fuelPct, at, samples.fuelPct, SLOW_READING_MAX_AGE_MS),
        }
        samples = { ...samples, ...Object.fromEntries(Object.entries(filtered).map(([key, value]) =>
          [key, { value, at, verified: true }])) }
        update(at)
        ticker ??= setInterval(() => update(performance.now()), 400)
      })
    } catch (error) {
      if (signal.aborted) {
        setState({ ...initial, phase: 'disconnected', message: notes.disconnected })
      } else if (!selected && error instanceof DOMException && error.name === 'NotFoundError') {
        setState({ ...initial, phase: 'disconnected', message: '선택된 어댑터가 없습니다. Android Bluetooth 설정에서 페어링하세요.' })
      } else {
        const message = error instanceof Error && error.message ? error.message : 'OBD 연결에 실패했습니다.'
        setState({ ...initial, phase: 'error', message })
      }
    } finally {
      clearInterval(ticker)
      active.current = null
    }
  }

  function disconnect() {
    active.current?.abort()
    setState({ ...initial, phase: 'closing', message: notes.closing })
  }

  function read<K extends keyof Readings>(key: K): Readings[K] | undefined {
    const sample = state.samples[key]
    if (sample && state.now - sample.at <= (slow.has(key) ? SLOW_READING_MAX_AGE_MS : FAST_READING_MAX_AGE_MS)) return sample.value
  }

  return {
    phase: state.phase,
    message: state.message,
    status: state.status,
    supported: window.isSecureContext && Boolean(navigator.serial),
    read,
    connect,
    disconnect,
  }
}
