import { decodeResponse, tasks, type Readings } from './protocol'

export const SPP = '00001101-0000-1000-8000-00805f9b34fb'
const setup = ['ATD', 'ATE0', 'ATL0', 'ATS1', 'ATH1', 'ATD0', 'ATSP6', 'ATCAF1', 'ATAL']

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export async function pollVehicle(
  port: SerialPort,
  signal: AbortSignal,
  onReadings: (values: Partial<Readings>, at: number) => void,
) {
  await port.open({ baudRate: 38400 })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined
  const unplugged = new AbortController()
  const disconnect = () => unplugged.abort(new Error('OBD 어댑터 연결이 끊겼습니다.'))
  const session = AbortSignal.any([signal, unplugged.signal])
  port.addEventListener('disconnect', disconnect)
  try {
    reader = port.readable?.getReader()
    writer = port.writable?.getWriter()
    if (!reader || !writer) throw new Error('OBD 포트의 읽기/쓰기 스트림을 열 수 없습니다.')
    const input = reader
    const output = writer
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    async function command(text: string, expectOk = false) {
      session.throwIfAborted()
      const timeout = new AbortController()
      const deadline = setTimeout(() => timeout.abort(new Error(`${text} 응답 시간 초과`)), 3000)
      const pending = AbortSignal.any([session, timeout.signal])
      let response = ''
      try {
        await abortable(output.write(encoder.encode(text + '\r')), pending)
        while (true) {
          const { value, done } = await abortable(input.read(), pending)
          if (done) throw new Error('OBD 어댑터 연결이 끊겼습니다.')
          response += decoder.decode(value)
          if (response.length > 16384) throw new Error('OBD 응답이 너무 깁니다.')
          const prompt = response.indexOf('>')
          if (prompt === -1) continue
          if (response.slice(prompt + 1).trim()) throw new Error('OBD 응답 경계 오류')
          break
        }
      } finally {
        clearTimeout(deadline)
      }
      if (expectOk && !response.split(/[\r\n>]/).some(line => line.trim().toUpperCase() === 'OK')) {
        throw new Error(`${text} 어댑터 설정 실패`)
      }
      return response
    }

    for (const text of setup) await command(text, true)
    const schedule = (Object.keys(tasks) as Array<keyof typeof tasks>).map(name => ({ name, due: 0 }))
    let header: string | undefined
    let lastRead = performance.now()
    while (true) {
      session.throwIfAborted()
      const next = schedule.reduce((earliest, item) => item.due < earliest.due ? item : earliest)
      const delay = next.due - performance.now()
      if (delay > 0) {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await abortable(new Promise<void>(resolve => { timer = setTimeout(resolve, delay) }), session)
        } finally {
          clearTimeout(timer)
        }
      }
      const task = tasks[next.name]
      if (header !== task.tx) {
        await command('ATSH' + task.tx, true)
        header = task.tx
      }
      const response = await command(task.cmd)
      const now = performance.now()
      next.due = now + task.interval
      let values: Partial<Readings>
      try {
        values = decodeResponse(next.name, response)
      } catch {
        if (now - lastRead > 8000) throw new Error('차량 응답 없음. 차량 전원과 어댑터를 확인하세요.')
        continue
      }
      lastRead = now
      onReadings(values, now)
    }
  } finally {
    port.removeEventListener('disconnect', disconnect)
    // Cancel pending I/O and release both locks before closing the port.
    const cleanup = [reader?.cancel(), writer?.abort()]
    reader?.releaseLock()
    writer?.releaseLock()
    await Promise.allSettled([...cleanup, port.close()])
  }
}
