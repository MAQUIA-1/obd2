#!/usr/bin/env python3
"""Targeted read-only dashboard PID candidates from pinned public definitions."""
import argparse
import json
from pathlib import Path
import time
from can_capture import ClassicCapture, append_json
from obd_poll import payload_for

ROOT = Path(__file__).resolve().parents[1]
# No address sweep or diagnostic session changes. One read per documented candidate.
PROBES = [
    ('body_doors_belts', '770', '778', '22BC03', 'OBDb/Hyundai-Santa-Fe'),
    ('body_locks_belts', '770', '778', '22BC04', 'OBDb/Kia-Optima'),
    ('body_hazard', '770', '778', '22BC05', 'OBDb/Kia-Optima'),
    ('body_brake_lamp', '770', '778', '22BC06', 'OBDb/Hyundai-Sonata'),
    ('body_indicators', '770', '778', '22BC08', 'OBDb/Hyundai-Santa-Fe'),
    ('body_headlights', '770', '778', '22BC09', 'OBDb/Hyundai-Santa-Fe'),
    ('body_lights_alt', '770', '778', '22BC10', 'OBDb/Hyundai-Sonata'),
    ('tpms', '7A0', '7A8', '22C00B', 'OBDb/Hyundai-Santa-Fe'),
    ('brake_switch', '7A0', '7A8', '22B008', 'OBDb/Hyundai-Sonata'),
    ('abs_wheels_brake', '7D1', '7D9', '220104', 'OBDb/Hyundai-Sonata'),
]
BCM_SOURCE = 'https://github.com/HK-Moebius/enirodashboard/blob/release/car_debug_obd2_kia.h'
SECONDARY = [
    ('bcm_input_' + did, '7A0', '7A8', '22' + did, BCM_SOURCE)
    for did in ['B001','B002','B003','B004','B005','B006','B007','B008','B009','B00A','B00C','B00D','B00E']
] + [
    ('cluster_distance', '7C6', '7CE', '22B002', 'OBDb/Hyundai-Sonata'),
    ('climate', '7B3', '7BB', '220100', 'OBDb/Kia-Optima'),
    ('abs_legacy', '7D1', '7D9', '2101', 'OBDb/Hyundai-Sonata'),
    ('ldc_auxiliary', '7E2', '7EA', '2102', 'OBDb/Hyundai-Sonata'),
    ('hybrid_motor', '7E3', '7EB', '2102', 'OBDb/Kia-Niro'),
]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--address', default='00:10:CC:4F:36:03')
    p.add_argument('--group', choices=['primary','secondary'], default='primary')
    a = p.parse_args()
    probes = PROBES if a.group == 'primary' else SECONDARY
    definitions = {}
    for name, tx, rx, cmd, repo in probes:
        if repo.startswith('https://'):
            definitions[name] = dict(repo=repo,path=repo,note='Documented e-Niro BCM input block; LF compatibility unknown')
            continue
        path = ROOT / 'research/sources' / repo / 'signalsets/v3/default.json'
        group = [x for x in json.loads(path.read_text())['commands'] if x['hdr'] == tx
                 and any(mode + pid == cmd for mode, pid in x['cmd'].items())]
        if not group: raise RuntimeError(f'No source definition for {name}')
        definitions[name] = dict(repo=repo, path=str(path.relative_to(ROOT)), definitions=group)
    a.output.mkdir(parents=True, exist_ok=False)
    append_json(a.output / 'metadata.jsonl', dict(timestamp=time.time(), vehicle='2015 LF Sonata Hybrid',
                transport='classic-spp', mode='targeted read-only dashboard candidates',
                warning='Cross-model definitions are candidates, not verified LF compatibility',
                probes=probes, sources=definitions))
    c = ClassicCapture(a.address, a.output)
    try:
        c.connect()
        for cmd in ['ATD','ATE0','ATL0','ATS1','ATH1','ATD0','ATSP6','ATCAF1','ATAL']:
            c.command(cmd,'OK')
        current = None
        for name, tx, rx, cmd, repo in probes:
            if current != tx:
                c.command('ATSH'+tx,'OK',verbose=False)
                current = tx
            started = time.time()
            response = c.command(cmd,verbose=False)
            row = dict(timestamp=time.time(),name=name,tx=tx,rx=rx,command=cmd,
                       elapsed_ms=(time.time()-started)*1000,response=response,source=definitions[name]['path'])
            try:
                payload = payload_for(response,rx)
                row['payload'] = payload.hex()
                if payload[:1] == b'\x7f':
                    row['status'] = 'response_pending' if payload == bytes.fromhex('7f2278') else 'negative_response'
                    row['negative_code'] = payload[2] if len(payload)>2 else None
                    if row['status'] == 'response_pending':
                        # Do not send another query while the ECU says it is busy.
                        c.pump(5)
                        row['response_after_wait'] = c.reply
                elif not payload.startswith(bytes([int(cmd[:2],16)+0x40])+bytes.fromhex(cmd[2:])):
                    row['status'] = 'unexpected_response'
                else:
                    row['status'] = 'positive_response_unverified_meaning'
            except ValueError as e:
                row['status']='no_valid_payload';row['error']=str(e)
            append_json(a.output/'probes.jsonl',row)
            print(json.dumps(row,ensure_ascii=False),flush=True)
            c.pump(.15)
    except Exception as e:
        c.log('error',text=str(e));raise
    finally:c.close()


if __name__ == '__main__':main()
