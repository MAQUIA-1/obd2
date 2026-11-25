import { describe, expect, it } from 'vitest'
import fixtures from '../../../research/fixtures/verified-poll-examples.json'
import { decodeResponse, tasks } from './protocol'

describe('LF HEV OBD responses', () => {
  it.each(Object.keys(tasks) as Array<keyof typeof tasks>)('decodes recorded %s', (name) => {
    const record = fixtures.examples[name]
    expect(decodeResponse(name, record.response)).toEqual(record.values)
  })

  it('rejects other ECUs, wrong PIDs, negative or short replies, and malformed data', () => {
    for (const reply of ['7E9 03 41 0D 00', '7E8 03 41 0C 00', '7E8 03 7F 01 12',
      '7E8 03 41 0D', '7E8 03 41 0D ZZ', 'NO DATA']) {
      expect(() => decodeResponse('speed', reply)).toThrow()
    }
  })

  it('rejects an out-of-order or truncated multi-frame reply', () => {
    const reply = fixtures.examples.gear.response
    expect(() => decodeResponse('gear', reply.replace('7E9 22', '7E9 25'))).toThrow()
    expect(() => decodeResponse('gear', reply.slice(0, reply.lastIndexOf('7E9')))).toThrow()
  })
})
