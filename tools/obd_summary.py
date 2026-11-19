#!/usr/bin/env python3
"""Summarize recorded transactions; extract separately labeled OBDb candidates offline."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import statistics


def summarize(folder, definitions):
    rows = [json.loads(line) for line in (folder / 'transactions.jsonl').read_text().splitlines()]
    groups = defaultdict(list)
    for row in rows: groups[row['task']].append(row)
    summary = {}
    for name, items in groups.items():
        good = [x for x in items if x['status'] == 'ok']
        intervals = [b['timestamp'] - a['timestamp'] for a, b in zip(good, good[1:])]
        summary[name] = dict(requests=len(items), valid_responses=len(good),
                            median_query_ms=statistics.median(x['query_ms'] for x in items),
                            median_update_interval_s=statistics.median(intervals) if intervals else None,
                            latest=good[-1]['values'] if good else None)
    result = dict(interpretation='Response format checks, not independent sensor accuracy validation', tasks=summary)
    (folder / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    candidates = []
    if definitions.exists():
        commands = json.loads(definitions.read_text())['commands']
        for task, request in [('bms', {'21': '01'}), ('gear', {'21': 'A0'})]:
            items = [x for x in groups.get(task, []) if x['status'] == 'ok']
            if not items: continue
            row = items[-1]
            payload = bytes.fromhex(row['payload'])
            # OBDb bix starts after positive response service + local identifier.
            # Only the two existing Mode 21 response groups are evaluated here.
            data = payload[2:]
            for command in commands:
                filt = command.get('filter', {})
                if command.get('hdr') != row['header'] or command.get('cmd') != request: continue
                if filt.get('from', 0) > 2015 or filt.get('to', 9999) < 2015: continue
                for signal in command.get('signals', []):
                    fmt = signal['fmt']; start, length = fmt['bix'], fmt['len']
                    if start + length > len(data) * 8: continue
                    shift = len(data) * 8 - start - length
                    raw = (int.from_bytes(data, 'big') >> shift) & ((1 << length) - 1)
                    signed = raw - (1 << length) if fmt.get('sign') and raw & (1 << (length - 1)) else raw
                    value = signed * fmt.get('mul', 1) / fmt.get('div', 1) + fmt.get('add', 0)
                    candidates.append(dict(id=signal['id'], name=signal.get('name'), raw=raw,
                                           value=value, unit=fmt.get('unit'), fmt=fmt,
                                           task=task, transaction_timestamp=row['timestamp'],
                                           status='candidate_not_independently_verified',
                                           source=str(definitions), source_dbg=command.get('dbg', False)))
    (folder / 'additional_candidates.json').write_text(json.dumps(candidates, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print('Offline candidates:',len(candidates))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('folder', type=Path)
    p.add_argument('--definitions', type=Path, default=Path(__file__).resolve().parents[1] / 'research/sources/OBDb/Hyundai-Sonata/signalsets/v3/default.json')
    a = p.parse_args()
    summarize(a.folder, a.definitions)
