#!/usr/bin/env python3
"""LF Sonata HEV read-only Classic SPP PID polling and timestamped raw evidence."""
import argparse
from collections import defaultdict
import datetime as dt
import json
from pathlib import Path
import re
import time

from can_capture import ClassicCapture, append_json

# These requests and byte offsets come from the existing project's LF HEV captures.
# No programming, actuator controls, diagnostic session changes or code clearing.
TASKS = [
    ('speed', '7E0', '7E8', '010D', .3),
    ('rpm', '7E0', '7E8', '010C', .7),
    ('gear', '7E1', '7E9', '21A0', .7),
    ('bms', '7E4', '7EC', '2101', 1.0),
    ('steering', '7D4', '7DC', '2101', .7),
    ('coolant', '7E0', '7E8', '0105', 10),
    ('fuel', '7E0', '7E8', '012F', 10),
    ('voltage', '7E0', '7E8', '0142', 10),
    ('outside', '7E0', '7E8', '0146', 10),
]


def payload_for(response, header):
    frames = []
    for line in re.split(r'[\r\n>]', response):
        line = re.sub(r'\s+', '', line).upper()
        if not line.startswith(header):
            continue
        data = line[len(header):]
        if not re.fullmatch(r'(?:[0-9A-F]{2}){1,8}', data):
            raise ValueError('Malformed CAN frame for ' + header)
        frames.append(bytes.fromhex(data))
    if not frames:
        raise ValueError('No matching ECU frame: ' + response.strip())
    first = frames[0]
    kind = first[0] >> 4
    if kind == 0:
        size = first[0] & 15
        if size > len(first) - 1 or len(frames) != 1:
            raise ValueError('Incomplete or ambiguous single-frame payload')
        return first[1:1 + size]
    if kind != 1 or len(first) < 2:
        raise ValueError('Expected ISO-TP first frame')
    size = ((first[0] & 15) << 8) | first[1]
    data = bytearray(first[2:])
    seq = 1
    for frame in frames[1:]:
        if frame[0] != (0x20 | (seq & 15)):
            raise ValueError('Missing or out-of-order ISO-TP frame')
        data.extend(frame[1:])
        seq += 1
    if len(data) < size:
        raise ValueError(f'Incomplete ISO-TP payload: {len(data)}/{size}')
    return bytes(data[:size])


def decode(name, payload):
    def need(prefix, size):
        if not payload.startswith(prefix) or len(payload) < size:
            raise ValueError(f'Wrong response service/PID or short payload: {payload.hex()}')
    def u16(index):
        return int.from_bytes(payload[index:index + 2], 'big')
    def s16(index):
        return int.from_bytes(payload[index:index + 2], 'big', signed=True)
    if name == 'bms':
        need(b'\x61\x01', 16)
        return dict(batteryCurrentA=s16(12) / 10, batterySocPct=payload[6] / 2,
                    batteryVoltageV=u16(14) / 10)
    if name == 'steering':
        need(b'\x61\x01', 7)
        return dict(steeringAngleDeg=s16(5) / 10)
    if name == 'gear':
        need(b'\x61\xa0', 23)
        gear = {12: 'M', 11: 'P', 10: 'R', 9: 'N', 8: 'D'}.get(payload[22])
        if gear is None:
            raise ValueError(f'Unknown selector: {payload[22]:02X}')
        return dict(gear=gear)
    pids = {'speed': (0x0D, 3), 'rpm': (0x0C, 4), 'coolant': (0x05, 3),
            'fuel': (0x2F, 3), 'voltage': (0x42, 4), 'outside': (0x46, 3)}
    pid, size = pids[name]
    need(bytes([0x41, pid]), size)
    if name == 'speed': return dict(speedKph=payload[2])
    if name == 'rpm': return dict(rpm=u16(2) / 4)
    if name == 'coolant': return dict(coolantTempC=payload[2] - 40)
    if name == 'fuel': return dict(fuelPct=payload[2] * 100 / 255)
    if name == 'voltage': return dict(controlVoltageV=u16(2) / 1000)
    return dict(outsideTempC=payload[2] - 40)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--address', default='00:10:CC:4F:36:03')
    p.add_argument('--seconds', type=float, default=30)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--only', nargs='+', choices=[t[0] for t in TASKS])
    args = p.parse_args()
    if args.seconds <= 0: p.error('--seconds must be positive')
    args.output.mkdir(parents=True, exist_ok=False)
    tasks = [dict(name=n, tx=tx, rx=rx, cmd=cmd, interval=interval, due=0)
             for n, tx, rx, cmd, interval in TASKS if not args.only or n in args.only]
    append_json(args.output / 'metadata.jsonl', dict(timestamp=time.time(), transport='classic-spp',
                vehicle='2015 LF Sonata Hybrid', mode='read-only diagnostic polling',
                duration_seconds=args.seconds, tasks=tasks,
                timing='host transaction request/response times; not CAN hardware timestamps',
                interpretation='existing LF PID definitions; displayed values require live-state validation'))
    c = ClassicCapture(args.address, args.output)
    header = None
    try:
        c.connect()
        for cmd in ['ATD', 'ATE0', 'ATL0', 'ATS1', 'ATH1', 'ATD0', 'ATSP6', 'ATCAF1', 'ATAL']:
            c.command(cmd, 'OK')
        deadline = time.monotonic() + args.seconds
        last_print = 0
        latest = {}
        count = defaultdict(int)
        while time.monotonic() < deadline:
            task = min(tasks, key=lambda t: t['due'])
            if task['due'] > time.monotonic():
                c.pump(min(.02, task['due'] - time.monotonic()))
                continue
            started = time.time()
            if header != task['tx']:
                c.command('ATSH' + task['tx'], 'OK', verbose=False)
                header = task['tx']
            qtime = time.time()
            # Transport timeout aborts the session: never attribute late bytes to the next PID.
            response = c.command(task['cmd'], verbose=False)
            ended = time.time()
            item = dict(timestamp=ended, started_at=started, task=task['name'],
                        header=header, response_header=task['rx'], command=task['cmd'],
                        elapsed_ms=(ended - started) * 1000, query_ms=(ended - qtime) * 1000,
                        response=response)
            try:
                payload = payload_for(response, task['rx'])
                item['payload'] = payload.hex()
                item['values'] = decode(task['name'], payload)
                item['status'] = 'ok'
                for key, value in item['values'].items():
                    latest[key] = dict(value=value, received_at=ended)
            except ValueError as exc:
                item['status'], item['error'] = 'invalid', str(exc)
            append_json(args.output / 'transactions.jsonl', item)
            count[task['name'] + ':' + item['status']] += 1
            task['due'] = time.monotonic() + task['interval']
            if time.monotonic() - last_print > 2:
                print(json.dumps(dict(time=dt.datetime.now().isoformat(timespec='seconds'),
                      values=latest, counts=dict(count)), ensure_ascii=False), flush=True)
                last_print = time.monotonic()
    except KeyboardInterrupt:
        c.log('stopped', reason='operator interrupt')
    except Exception as exc:
        c.log('error', text=str(exc))
        raise
    finally:
        c.close()


if __name__ == '__main__':
    main()
