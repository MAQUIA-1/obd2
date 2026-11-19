import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from obd_poll import payload_for, decode


class PollDecodeTest(unittest.TestCase):
    def test_standard_and_short_response(self):
        self.assertEqual(decode('rpm', payload_for('7E8 04 41 0C 0F A0\r>', '7E8')), {'rpm': 1000})
        self.assertEqual(decode('coolant', payload_for('7E8 03 41 05 69\r>', '7E8')), {'coolantTempC': 65})
        for response in ['7E8 04 41 0C', '7E8 04 41 0C 10']:
            with self.assertRaises(ValueError): payload_for(response, '7E8')
        with self.assertRaises(ValueError): decode('rpm', b'\x41\x0c')

    def test_ecu_selection_and_negative_response(self):
        response = '7E9 03 41 0D 20\r7E8 03 41 0D 00\r>'
        self.assertEqual(decode('speed', payload_for(response, '7E8')), {'speedKph': 0})
        with self.assertRaises(ValueError): decode('speed', payload_for('7E8 03 7F 01 12', '7E8'))

    def test_isotp_complete_and_missing_sequence(self):
        good = '7EC 10 0A 61 01 00 00 00 00\r7EC 21 69 00 00 00 00 00 00'
        self.assertEqual(len(payload_for(good, '7EC')), 10)
        with self.assertRaises(ValueError): payload_for(good.split('\r')[0], '7EC')
        with self.assertRaises(ValueError): payload_for(good.replace('7EC 21', '7EC 22'), '7EC')

    def test_extended_signed_and_selector(self):
        payload = bytearray(23)
        payload[:2] = b'\x61\x01'
        payload[6] = 105
        payload[12:16] = bytes.fromhex('FFE70AAD')
        self.assertEqual(decode('bms', bytes(payload)), dict(batteryCurrentA=-2.5, batterySocPct=52.5, batteryVoltageV=273.3))
        payload[:2] = b'\x61\xa0';payload[22] = 11
        self.assertEqual(decode('gear', bytes(payload)), {'gear': 'P'})
        payload[22] = 0
        with self.assertRaises(ValueError): decode('gear', bytes(payload))


if __name__ == '__main__': unittest.main()
