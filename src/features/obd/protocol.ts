export type Gear = 'P' | 'R' | 'N' | 'D' | 'M'

export type Readings = {
  speedKph: number
  rpm: number
  gear: Gear
  batteryCurrentA: number
  batterySocPct: number
  batteryVoltageV: number
  steeringAngleDeg: number
  coolantTempC: number
  fuelPct: number
  controlVoltageV: number
  outsideTempC: number
}

function word(bytes: number[], index: number) {
  return bytes[index] * 256 + bytes[index + 1]
}

function signedWord(bytes: number[], index: number) {
  const value = word(bytes, index)
  return value >= 0x8000 ? value - 0x10000 : value
}

const gears: Partial<Record<number, Gear>> = { 8: 'D', 9: 'N', 10: 'R', 11: 'P', 12: 'M' }

// The requests and offsets match the LF HEV captures and tools/obd_poll.py.
export const tasks = {
  speed: { tx: '7E0', rx: '7E8', cmd: '010D', interval: 300, size: 3,
    decode: (p: number[]) => ({ speedKph: p[2] }) },
  rpm: { tx: '7E0', rx: '7E8', cmd: '010C', interval: 700, size: 4,
    decode: (p: number[]) => ({ rpm: word(p, 2) / 4 }) },
  gear: { tx: '7E1', rx: '7E9', cmd: '21A0', interval: 700, size: 23,
    decode: (p: number[]) => {
      const gear = gears[p[22]]
      if (!gear) throw new Error('알 수 없는 기어 응답')
      return { gear }
    } },
  bms: { tx: '7E4', rx: '7EC', cmd: '2101', interval: 1000, size: 16,
    decode: (p: number[]) => ({ batteryCurrentA: signedWord(p, 12) / 10,
      batterySocPct: p[6] / 2, batteryVoltageV: word(p, 14) / 10 }) },
  steering: { tx: '7D4', rx: '7DC', cmd: '2101', interval: 700, size: 7,
    decode: (p: number[]) => ({ steeringAngleDeg: signedWord(p, 5) / 10 }) },
  coolant: { tx: '7E0', rx: '7E8', cmd: '0105', interval: 10000, size: 3,
    decode: (p: number[]) => ({ coolantTempC: p[2] - 40 }) },
  fuel: { tx: '7E0', rx: '7E8', cmd: '012F', interval: 10000, size: 3,
    decode: (p: number[]) => ({ fuelPct: p[2] * 100 / 255 }) },
  voltage: { tx: '7E0', rx: '7E8', cmd: '0142', interval: 10000, size: 4,
    decode: (p: number[]) => ({ controlVoltageV: word(p, 2) / 1000 }) },
  outside: { tx: '7E0', rx: '7E8', cmd: '0146', interval: 10000, size: 3,
    decode: (p: number[]) => ({ outsideTempC: p[2] - 40 }) },
}

function payloadFor(response: string, header: string) {
  const frames = response.split(/[\r\n>]/).map(line => line.replace(/\s/g, '').toUpperCase())
    .filter(line => line.startsWith(header)).map(line => {
      const data = line.slice(header.length)
      if (!/^(?:[0-9A-F]{2}){1,8}$/.test(data)) throw new Error('CAN 프레임 형식 오류')
      return (data.match(/../g) ?? []).map(byte => Number.parseInt(byte, 16))
    })
  const [first, ...rest] = frames
  if (!first) throw new Error('ECU 응답 없음')
  const kind = first[0] >> 4
  if (kind === 0) {
    const size = first[0] & 15
    if (rest.length || !size || size >= first.length) throw new Error('단일 프레임 길이 오류')
    return first.slice(1, 1 + size)
  }
  if (kind !== 1 || first.length < 3) throw new Error('ISO-TP 시작 프레임 오류')
  const size = ((first[0] & 15) << 8) | first[1]
  const payload = first.slice(2)
  if (size <= payload.length) throw new Error('ISO-TP 선언 길이 오류')
  for (const [index, frame] of rest.entries()) {
    if (frame.length < 2 || payload.length >= size || frame[0] !== (0x20 | ((index + 1) & 15))) {
      throw new Error('ISO-TP 연속 프레임 순서 오류')
    }
    payload.push(...frame.slice(1))
  }
  if (payload.length < size) throw new Error('ISO-TP 응답 누락')
  return payload.slice(0, size)
}

export function decodeResponse(name: keyof typeof tasks, response: string): Partial<Readings> {
  const task = tasks[name]
  const payload = payloadFor(response, task.rx)
  const service = Number.parseInt(task.cmd.slice(0, 2), 16) + 0x40
  const pid = Number.parseInt(task.cmd.slice(2), 16)
  if (payload.length < task.size || payload[0] !== service || payload[1] !== pid) {
    throw new Error('응답 서비스, PID 또는 길이 불일치')
  }
  return task.decode(payload)
}
