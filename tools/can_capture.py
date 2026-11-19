#!/usr/bin/env python3
"""BlueZ Classic SPP (default) / BLE ELM capture. No PID requests or CAN injection."""
import argparse
import csv
import datetime as dt
import json
from pathlib import Path
import re
import socket
import time

SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
NOTIFY = '0000fff1-0000-1000-8000-00805f9b34fb'
WRITE = '0000fff2-0000-1000-8000-00805f9b34fb'
SPP = '00001101-0000-1000-8000-00805f9b34fb'
BLUEZ = 'org.bluez'
PROPS = 'org.freedesktop.DBus.Properties'


def parse_frame(line):
    """ATH1 ATS1 ATD0 ATCAF0 monitor output, 11/29-bit CAN, no DLC."""
    parts = line.strip().upper().split()
    if not parts or not re.fullmatch(r'(?:[0-9A-F]{3}|[0-9A-F]{8})', parts[0]):
        return None
    if not 1 <= len(parts[1:]) <= 8:
        return None
    if any(not re.fullmatch(r'[0-9A-F]{2}', x) for x in parts[1:]):
        return None
    can_id = int(parts[0], 16)
    if can_id > (0x7FF if len(parts[0]) == 3 else 0x1FFFFFFF):
        return None
    return parts[0], ''.join(parts[1:])


def append_json(path, data):
    with Path(path).open('a', encoding='utf-8') as f:
        f.write(json.dumps(data, ensure_ascii=False) + '\n')


class Capture:
    def __init__(self, address, output):
        # Deferred imports keep parser/analyzer usable without desktop dependencies.
        import dbus
        from dbus.mainloop.glib import DBusGMainLoop
        from gi.repository import GLib
        DBusGMainLoop(set_as_default=True)
        self.dbus, self.context = dbus, GLib.MainContext.default()
        self.bus = dbus.SystemBus()
        self.address, self.output = address.upper(), output
        self.buffer, self.reply = '', ''
        self.monitoring, self.device, self.notify = False, None, None
        self.match = None
        self.failure = None
        self.raw_file = (output / 'raw.jsonl').open('w', encoding='utf-8')
        self.frame_file = (output / 'frames.csv').open('w', newline='')
        self.writer = csv.writer(self.frame_file)
        self.writer.writerow(['timestamp', 'can_id', 'data'])

    def pump(self, seconds):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            while self.context.pending():
                self.context.iteration(False)
            time.sleep(.005)

    def log(self, kind, **fields):
        self.raw_file.write(json.dumps({'timestamp': time.time(), 'kind': kind, **fields}) + '\n')
        self.raw_file.flush()

    def objects(self):
        obj = self.bus.get_object(BLUEZ, '/')
        return self.dbus.Interface(obj, 'org.freedesktop.DBus.ObjectManager').GetManagedObjects()

    def connect(self):
        objects = self.objects()
        path = next((p for p, v in objects.items()
                     if str(v.get('org.bluez.Device1', {}).get('Address', '')).upper() == self.address), None)
        if not path:
            raise RuntimeError('Device not discovered. Discover it with bluetoothctl scan on first.')
        self.device = self.dbus.Interface(self.bus.get_object(BLUEZ, path), 'org.bluez.Device1')
        self.device.Connect(timeout=20)
        props = self.dbus.Interface(self.bus.get_object(BLUEZ, path), PROPS)
        deadline = time.monotonic() + 20
        while not props.Get('org.bluez.Device1', 'ServicesResolved'):
            if time.monotonic() > deadline:
                raise TimeoutError('BLE services did not resolve')
            self.pump(.1)
        objects = self.objects()
        services = {str(p) for p, v in objects.items()
                    if str(v.get('org.bluez.GattService1', {}).get('UUID', '')).lower() == SERVICE
                    and str(v.get('org.bluez.GattService1', {}).get('Device', '')) == str(path)}
        chars = {str(v['org.bluez.GattCharacteristic1']['UUID']).lower(): p
                 for p, v in objects.items() if 'org.bluez.GattCharacteristic1' in v
                 and str(v['org.bluez.GattCharacteristic1'].get('Service')) in services}
        if NOTIFY not in chars or WRITE not in chars:
            raise RuntimeError('Expected FFF0/FFF1/FFF2 BLE interface not found')
        self.notify = self.dbus.Interface(self.bus.get_object(BLUEZ, chars[NOTIFY]), 'org.bluez.GattCharacteristic1')
        self.write = self.dbus.Interface(self.bus.get_object(BLUEZ, chars[WRITE]), 'org.bluez.GattCharacteristic1')
        self.match = self.bus.add_signal_receiver(self.on_notify, signal_name='PropertiesChanged',
                                                 dbus_interface=PROPS, bus_name=BLUEZ, path=chars[NOTIFY])
        self.notify.StartNotify()
        self.props = props
        self.log('connected', address=self.address)

    def on_notify(self, interface, changed, invalidated):
        if str(interface) != 'org.bluez.GattCharacteristic1' or 'Value' not in changed:
            return
        self.receive(bytes(changed['Value']))

    def receive(self, raw):
        timestamp = time.time()
        text = raw.decode('ascii', errors='replace')
        self.log('rx', hex=raw.hex(), text=text)
        if not self.monitoring:
            self.reply += text
            return
        self.buffer += text
        lines = re.split(r'[\r\n]', self.buffer)
        self.buffer = lines.pop()
        for line in lines:
            if not line.strip():
                continue
            frame = parse_frame(line)
            if frame:
                self.writer.writerow([f'{timestamp:.6f}', *frame])
                self.frame_file.flush()
            else:
                self.log('monitor_status', text=line)
                if any(x in line.upper() for x in ['BUFFER FULL', 'CAN ERROR', 'BUS ERROR', 'STOPPED', '?', 'UNABLE TO CONNECT']):
                    self.failure = line.strip()
        if '>' in self.buffer:
            self.failure = 'Monitor returned to prompt: ' + self.buffer.strip()

    def send(self, text):
        self.log('tx', text=text)
        self.write.WriteValue(self.dbus.Array(text.encode('ascii'), signature='y'),
                              self.dbus.Dictionary({'type': 'command'}, signature='sv'), timeout=5)

    def command(self, text, expected=None, verbose=True):
        self.reply = ''
        self.send(text + '\r')
        deadline = time.monotonic() + 3
        while '>' not in self.reply:
            if self.failure:
                raise RuntimeError(self.failure)
            if time.monotonic() > deadline:
                raise TimeoutError(f'{text}: no complete response; refusing to continue')
            self.pump(.02)
        result = self.reply
        if verbose:
            print(text, repr(result), flush=True)
        if expected and not any(line.strip().upper() == expected for line in re.split(r'[\r\n>]', result)):
            raise RuntimeError(f'{text}: expected {expected}; refusing to continue')
        return result

    def run(self, duration):
        self.connect()
        # These configure the interpreter. No 01xx/21xx PID requests are issued.
        self.command('ATI')
        for cmd in ['ATE0', 'ATL0', 'ATS1', 'ATH1', 'ATD0', 'ATSP6', 'ATCAF0', 'ATCSM1']:
            self.command(cmd, 'OK')
        self.reply, self.buffer = '', ''
        self.monitoring = True
        self.send('ATMA\r')
        print(f'Monitoring for {duration}s -> {self.output}', flush=True)
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            self.pump(.1)
            if self.failure:
                raise RuntimeError('Capture stopped: ' + self.failure)
            if not self.props.Get('org.bluez.Device1', 'Connected'):
                raise RuntimeError('Bluetooth disconnected')

    def close(self):
        if self.monitoring:
            try:
                self.send('\r')  # Interrupt MA; do not automatically restart after data loss.
                self.pump(.3)
            except Exception as exc:
                self.log('cleanup_error', text=str(exc))
        if self.buffer.strip():
            self.log('trailing_fragment', text=self.buffer)
        if self.notify:
            try:
                self.notify.StopNotify()
            except Exception:
                pass
        if self.match:
            self.match.remove()
        if self.device:
            try:
                # BlueZ can call Profile1.RequestDisconnection during this call.
                # Keep GLib dispatching rather than waiting synchronously.
                self.device.Disconnect(reply_handler=lambda: None, error_handler=lambda error: None)
                self.pump(.2)
            except Exception:
                pass
        self.raw_file.close()
        self.frame_file.close()


class ClassicCapture(Capture):
    """BlueZ Profile1 supplies an RFCOMM stream; no guessed RFCOMM channel."""

    def __init__(self, address, output):
        super().__init__(address, output)
        self.stream = None
        self.profile = None
        self.manager = None
        self.registered = False

    def connect(self):
        import dbus.service
        objects = self.objects()
        path = next((p for p, v in objects.items()
                     if str(v.get('org.bluez.Device1', {}).get('Address', '')).upper() == self.address), None)
        if not path:
            raise RuntimeError('Device not discovered. Discover it with bluetoothctl first.')
        info = objects[path]['org.bluez.Device1']
        if SPP not in [str(x).lower() for x in info.get('UUIDs', [])]:
            raise RuntimeError('SPP UUID not advertised in BlueZ device info. Resolve services before retrying; do not assume channel 1.')
        self.device = self.dbus.Interface(self.bus.get_object(BLUEZ, path), 'org.bluez.Device1')
        self.props = self.dbus.Interface(self.bus.get_object(BLUEZ, path), PROPS)
        owner = self

        class Profile(dbus.service.Object):
            @dbus.service.method('org.bluez.Profile1', in_signature='', out_signature='')
            def Release(self):
                owner.registered = False
                owner.failure = 'SPP profile released'
                owner.close_stream()

            @dbus.service.method('org.bluez.Profile1', in_signature='oha{sv}', out_signature='')
            def NewConnection(self, device, fd, properties):
                if str(device) != str(path) or owner.stream is not None:
                    raise dbus.exceptions.DBusException('Unexpected SPP connection', name='org.bluez.Error.Rejected')
                owner.stream = socket.socket(fileno=fd.take())
                owner.stream.setblocking(False)

            @dbus.service.method('org.bluez.Profile1', in_signature='o', out_signature='')
            def RequestDisconnection(self, device):
                owner.failure = 'SPP disconnected'
                owner.close_stream()

        self.profile_path = '/org/obd2/capture/spp'
        self.profile = Profile(self.bus, self.profile_path)
        self.manager = self.dbus.Interface(self.bus.get_object(BLUEZ, '/org/bluez'), 'org.bluez.ProfileManager1')
        self.manager.RegisterProfile(self.profile_path, SPP,
                                     self.dbus.Dictionary({'Name': 'OBD2 capture', 'Role': 'client'}, signature='sv'))
        self.registered = True
        errors = []
        self.device.ConnectProfile(SPP, reply_handler=lambda: None,
                                   error_handler=lambda error: errors.append(str(error)), timeout=20)
        deadline = time.monotonic() + 22
        while self.stream is None:
            self.pump(.02)
            if errors or self.failure:
                raise RuntimeError('SPP connect failed: ' + (errors[0] if errors else self.failure))
            if time.monotonic() > deadline:
                raise TimeoutError('SPP stream was not supplied by BlueZ')
        self.log('connected', address=self.address, transport='classic-spp')

    def read_stream(self):
        for _ in range(64):
            if self.stream is None:
                return
            try:
                data = self.stream.recv(65536)
            except BlockingIOError:
                return
            except OSError as exc:
                self.failure = 'SPP receive failed: ' + str(exc)
                self.close_stream()
                return
            if not data:
                self.failure = 'SPP stream closed'
                self.close_stream()
                return
            self.receive(data)

    def pump(self, seconds):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            while self.context.pending():
                self.context.iteration(False)
            self.read_stream()
            time.sleep(.005)

    def send(self, text):
        if self.stream is None:
            raise RuntimeError('SPP stream is not connected')
        self.log('tx', text=text)
        data = memoryview(text.encode('ascii'))
        deadline = time.monotonic() + 3
        while data:
            try:
                sent = self.stream.send(data)
                if not sent:
                    raise RuntimeError('SPP stream closed during write')
                data = data[sent:]
            except BlockingIOError:
                if time.monotonic() > deadline:
                    raise TimeoutError('SPP write timeout')
                self.pump(.01)
                if self.stream is None:
                    raise RuntimeError('SPP disconnected during write')

    def close_stream(self):
        if self.stream is not None:
            self.stream.close()
            self.stream = None

    def close(self):
        try:
            super().close()
        finally:
            self.close_stream()
            if self.registered:
                try:
                    self.manager.UnregisterProfile(self.profile_path)
                except Exception:
                    pass
            if self.profile is not None:
                self.profile.remove_from_connection()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    cap = sub.add_parser('capture')
    cap.add_argument('--address', required=True)
    cap.add_argument('--transport', choices=['classic', 'ble'], default='classic')
    cap.add_argument('--seconds', type=float, default=30)
    cap.add_argument('--output', type=Path)
    mark = sub.add_parser('mark')
    mark.add_argument('directory', type=Path)
    mark.add_argument('label')
    args = parser.parse_args()
    if args.action == 'mark':
        if not args.directory.is_dir():
            parser.error('Capture directory does not exist')
        append_json(args.directory / 'events.jsonl', {'timestamp': time.time(), 'label': args.label})
        return
    if args.seconds <= 0:
        parser.error('--seconds must be positive')
    output = args.output or Path('captures') / dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    output.mkdir(parents=True, exist_ok=False)
    append_json(output / 'metadata.jsonl', {'timestamp': time.time(), 'address': args.address,
                'duration_seconds': args.seconds, 'mode': 'ATMA silent',
                'transport': args.transport,
                'timestamp_note': 'host Bluetooth chunk receipt time, not hardware CAN frame time'})
    capture = (ClassicCapture if args.transport == 'classic' else Capture)(args.address, output)
    try:
        capture.run(args.seconds)
    except KeyboardInterrupt:
        print('Stopped by user')
    except Exception as exc:
        capture.log('error', text=str(exc))
        raise
    finally:
        capture.close()


if __name__ == '__main__':
    main()
