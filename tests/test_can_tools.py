import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest
import io
import socket


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / 'tools' / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


capture = load('can_capture')
analyzer = load('can_analyze')


class CanToolsTest(unittest.TestCase):
    def receiver(self, cls=capture.Capture):
        obj = cls.__new__(cls)
        obj.buffer, obj.reply = '', ''
        obj.monitoring, obj.failure = True, None
        obj.logs = []
        obj.log = lambda kind, **fields: obj.logs.append((kind, fields))
        obj.frame_file = io.StringIO()
        obj.writer = csv.writer(obj.frame_file)
        return obj

    def test_fragmented_stream(self):
        obj = self.receiver()
        obj.receive(b'2B0 00')
        obj.receive(b' 01\r\n541 00 10\r')
        rows = list(csv.reader(io.StringIO(obj.frame_file.getvalue())))
        self.assertEqual([r[1:] for r in rows], [['2B0', '0001'], ['541', '0010']])
        self.assertEqual(obj.reply, '')
        obj.receive(b'BUFFER FULL\r>')
        self.assertIsNotNone(obj.failure)

    def test_classic_socket_stream(self):
        obj = self.receiver(capture.ClassicCapture)
        local, remote = socket.socketpair()
        obj.stream = local
        local.setblocking(False)
        try:
            remote.sendall(b'2B0 01 00\r')
            obj.read_stream()
            self.assertIn('2B0,0100', obj.frame_file.getvalue())
            obj.send('ATI\r')
            self.assertEqual(remote.recv(32), b'ATI\r')
            remote.close()
            obj.read_stream()
            self.assertIsNone(obj.stream)
            self.assertIn('closed', obj.failure)
        finally:
            obj.close_stream()
            remote.close()

    def test_initialization_rejection_stops_before_monitor(self):
        obj = self.receiver()
        obj.monitoring = False
        obj.connect = lambda: None
        sent = []
        def send(text):
            sent.append(text)
            obj.receive(b'?\r>' if text == 'ATCSM1\r' else b'OK\r>')
        obj.send = send
        with self.assertRaisesRegex(RuntimeError, 'ATCSM1'):
            obj.run(.01)
        self.assertNotIn('ATMA\r', sent)
        self.assertTrue(all(x.startswith('AT') for x in sent))

    def test_frames(self):
        self.assertEqual(capture.parse_frame('7E8 03 41 0D 00'), ('7E8', '03410D00'))
        self.assertEqual(capture.parse_frame('18DAF110 01 FF'), ('18DAF110', '01FF'))
        for invalid in ['BUFFER FULL', 'STOPPED', '>', 'ATMA', '7E8 0', 'FFF 00', 'FFFFFFFF 00', '7E8 ' + '00 ' * 9]:
            self.assertIsNone(capture.parse_frame(invalid), invalid)

    def test_report_and_export(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            with (directory / 'frames.csv').open('w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'can_id', 'data'])
                writer.writerows([['1.000000', '123', '00'], ['1.100000', '123', '01'], ['1.200000', '124', 'FF00']])
            capture.append_json(directory / 'events.jsonl', {'timestamp': 1.1, 'label': '<center>'})
            analyzer.analyze(directory)
            report = (directory / 'report.html').read_text()
            self.assertIn('100.0% transitions', report)
            self.assertIn('&lt;center&gt;', report)
            self.assertIn('can0 123#01', (directory / 'candump.log').read_text())
            with (directory / 'statistics.csv').open() as f:
                self.assertEqual(len(list(csv.DictReader(f))), 2)

    def test_empty_capture(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / 'frames.csv').write_text('timestamp,can_id,data\n')
            analyzer.analyze(directory)
            self.assertIn('0 frames / 0 CAN IDs', (directory / 'report.html').read_text())


if __name__ == '__main__':
    unittest.main()
