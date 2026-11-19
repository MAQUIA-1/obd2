#!/usr/bin/env python3
"""Record previously confirmed BCM read groups for operator-controlled state comparisons."""
import argparse,json,time
from pathlib import Path
from can_capture import ClassicCapture,append_json
from obd_poll import payload_for

DIDS=['B001','B002','B003','B004','B005','B006','B007','B008','B009','B00A','B00C','B00D']


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--output',type=Path,required=True)
 p.add_argument('--seconds',type=float,default=300)
 p.add_argument('--dids',nargs='+',choices=DIDS,default=DIDS,
                help='Previously responsive read groups to collect; narrow for faster comparisons')
 a=p.parse_args()
 if a.seconds<=0:p.error('--seconds must be positive')
 a.output.mkdir(parents=True,exist_ok=False)
 append_json(a.output/'metadata.jsonl',dict(timestamp=time.time(),transport='classic-spp',vehicle='2015 LF Sonata Hybrid',mode='BCM read-only comparisons',tx='7A0',rx='7A8',dids=a.dids,meaning='unknown bits; controlled observations required'))
 c=ClassicCapture('00:10:CC:4F:36:03',a.output)
 try:
  c.connect()
  for cmd in ['ATD','ATE0','ATL0','ATS1','ATH1','ATD0','ATSP6','ATCAF1','ATAL','ATSH7A0']:
   c.command(cmd,'OK')
  end=time.monotonic()+a.seconds;cycle=0
  while time.monotonic()<end:
   cycle+=1;statuses={}
   for did in a.dids:
    if time.monotonic()>=end:break
    start=time.time();response=c.command('22'+did,verbose=False)
    row=dict(timestamp=time.time(),started_at=start,name=did,command='22'+did,response=response,cycle=cycle)
    try:
     payload=payload_for(response,'7A8')
     if not payload.startswith(bytes.fromhex('62'+did)):raise ValueError('Wrong service/DID: '+payload.hex())
     row.update(status='ok',payload=payload.hex(),data=payload[3:].hex())
    except ValueError as e:row.update(status='invalid',error=str(e))
    append_json(a.output/'transactions.jsonl',row);statuses[did]=row['status']
    c.pump(.05)
   print(json.dumps(dict(cycle=cycle,statuses=statuses)),flush=True)
 except KeyboardInterrupt:c.log('stopped',reason='operator interrupt')
 except Exception as e:c.log('error',text=str(e));raise
 finally:c.close()


if __name__=='__main__':main()
