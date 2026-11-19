#!/usr/bin/env python3
"""Offline CAN change heatmap and SavvyCAN-compatible candump export."""
import argparse
from collections import defaultdict, Counter
import csv
import html
import json
from pathlib import Path
import statistics


def analyze(directory):
    groups = defaultdict(list)
    with (directory / 'frames.csv').open() as f:
        for row in csv.DictReader(f):
            groups[row['can_id']].append((float(row['timestamp']), bytes.fromhex(row['data'])))
    body = []
    with (directory / 'statistics.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['can_id', 'frames', 'observed_duration_s', 'median_host_interval_ms', 'dlc_counts'])
        for can_id, rows in sorted(groups.items(), key=lambda x: int(x[0], 16)):
            intervals = [(b[0] - a[0]) * 1000 for a, b in zip(rows, rows[1:])]
            median = statistics.median(intervals) if intervals else 0
            dlcs = dict(Counter(len(data) for _, data in rows))
            writer.writerow([can_id, len(rows), rows[-1][0] - rows[0][0], median, json.dumps(dlcs)])
            cells = []
            for byte in range(8):
                for bit in range(7, -1, -1):
                    comparisons = [(a[1][byte], b[1][byte]) for a, b in zip(rows, rows[1:])
                                   if byte < len(a[1]) and byte < len(b[1])]
                    ratio = sum(bool((a ^ b) & (1 << bit)) for a, b in comparisons) / len(comparisons) if comparisons else None
                    color = '#eeeeee' if ratio is None else f'hsl(210 85% {97 - 65 * ratio:.1f}%)'
                    title = f'byte {byte}, bit {bit}: ' + (f'{ratio:.1%} transitions' if ratio is not None else 'no comparable frames')
                    cells.append(f'<td style="background:{color}" title="{title}"></td>')
            body.append(f'<tr><th>{can_id}</th><td>{len(rows)}</td><td>{median:.1f}</td>{"".join(cells)}</tr>')
    with (directory / 'candump.log').open('w') as f, (directory / 'frames.csv').open() as source:
        for row in csv.DictReader(source):
            f.write(f"({row['timestamp']}) can0 {row['can_id']}#{row['data']}\n")
    events = []
    path = directory / 'events.jsonl'
    if path.exists():
        for line in path.read_text().splitlines():
            event = json.loads(line)
            events.append(f"<li>{event['timestamp']:.3f}: {html.escape(event['label'])}</li>")
    headers = ''.join(f'<th colspan="8">Byte {i} (bit 7 → 0)</th>' for i in range(8))
    page = '''<!doctype html><meta charset="utf-8"><title>CAN change analysis</title>
<style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px}td[title]{min-width:7px;height:22px;padding:1px}th{white-space:nowrap}section{overflow:auto}</style>
<h1>CAN bit transition heatmap</h1><p>Darker blue = more transitions between adjacent received frames. Hover for ratios. Gray = no comparison.</p>
<p>Host BLE receipt timestamps: intervals are not precise CAN bus timing. A changing bit is not proof of a sensor signal; counters and checksums also change.</p>'''
    page += f'<p>{sum(len(x) for x in groups.values())} frames / {len(groups)} CAN IDs.</p>'
    page += f'<section><table><tr><th>ID</th><th>Frames</th><th>Median ms</th>{headers}</tr>{"".join(body)}</table></section>'
    page += '<h2>Experiment markers</h2><p>Markers reflect operator acknowledgement time, with conversation delay.</p><ul>' + ''.join(events) + '</ul>'
    (directory / 'report.html').write_text(page, encoding='utf-8')
    print(f'{sum(len(x) for x in groups.values())} frames, {len(groups)} IDs -> {directory / "report.html"}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    analyze(parser.parse_args().directory)
