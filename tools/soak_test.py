from pathlib import Path as _BootstrapPath
import sys as _bootstrap_sys
_bootstrap_sys.path.insert(0, str(_BootstrapPath(__file__).resolve().parent.parent / 'app'))
"""Read-only live stability sampler. Does not restart services or send TikTok events."""
import argparse
import datetime
import json
import os
from pathlib import Path
import time
import urllib.request
from app_config import runtime_config


def memory_summary(samples, warmup_seconds=300, max_growth_mb=100):
    values=[s['memory_rss_bytes'] for s in samples
            if s['elapsed']>=warmup_seconds and 'memory_rss_bytes' in s]
    if len(values)<2:
        return {'status':'insufficient_data','warmup_seconds':warmup_seconds}
    growth=values[-1]-values[0]
    return {'status':'growth_exceeded' if growth>max_growth_mb*1024**2 else 'within_limit',
            'growth_mb':round(growth/1024**2,2),'peak_mb':round(max(values)/1024**2,2),
            'limit_mb':max_growth_mb,'warmup_seconds':warmup_seconds}


def run(seconds, interval, output, pid=None, *, warmup_seconds=300, max_growth_mb=100):
    started=datetime.datetime.now().isoformat();start=time.monotonic();samples=[];errors=[]
    base_url=runtime_config().local_url
    target=Path(output);target.parent.mkdir(parents=True,exist_ok=True)
    process=None
    if pid:
        try:
            import psutil
            process=psutil.Process(pid)
        except Exception as exc:
            errors.append('Memory sampler unavailable: '+str(exc))
    while True:
        at=time.monotonic();sample={'elapsed':round(at-start,2)}
        try:
            with urllib.request.urlopen(base_url+'/feed',timeout=5) as response:
                feed=json.load(response)
            sample.update(latency_ms=round((time.monotonic()-at)*1000,2),session=feed['session'],
                          visible_comments=len(feed['comments']),stats=feed['stats'])
            with urllib.request.urlopen(base_url+'/status',timeout=5) as response:
                sample['connected']=json.load(response)['connected']
            if process:
                if not process.is_running():
                    raise RuntimeError('Original server process is no longer running')
                sample['memory_rss_bytes']=process.memory_info().rss
            if len(feed['comments'])>200:
                errors.append('Feed exceeded 200 comments')
            if len({c['id'] for c in feed['comments']})!=len(feed['comments']):
                errors.append('Duplicate IDs in feed')
        except Exception as exc:
            sample['error']=str(exc);errors.append(str(exc))
        samples.append(sample)
        remaining=seconds-(time.monotonic()-start)
        memory=memory_summary(samples,warmup_seconds,max_growth_mb)
        if remaining<=0 and pid and memory['status']!='within_limit':
            errors.append('Memory validation: '+memory['status'])
        report={'started':started,'status':'running' if remaining>0 else 'finished','duration_seconds':round(time.monotonic()-start,2),
                'requested_seconds':seconds,'server_pid':pid,'base_url':base_url,'memory':memory,
                'passed':not errors if remaining<=0 else None,
                'samples':samples,'errors':errors,'scope':'Read-only HTTP, feed invariants and optional server RSS; not microphone, audible TTS or streaming software.'}
        temporary=target.with_suffix(target.suffix+'.tmp')
        temporary.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(temporary,target)
        if remaining<=0:break
        time.sleep(min(interval,remaining))
    print(json.dumps({'duration_seconds':report['duration_seconds'],'samples':len(samples),'errors':len(errors),'report':str(output)}))
    return not errors

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--seconds',type=int,default=14400);p.add_argument('--interval',type=int,default=15);p.add_argument('--output',default='data/diagnostics/soak-results.json');p.add_argument('--pid',type=int)
    p.add_argument('--warmup-seconds',type=int,default=300);p.add_argument('--max-growth-mb',type=float,default=100);a=p.parse_args()
    if not 1<=a.seconds<=86400 or not 1<=a.interval<=300:p.error('seconds: 1..86400; interval: 1..300')
    if a.warmup_seconds<0 or not 0<a.max_growth_mb<100000:p.error('warmup-seconds >= 0; max-growth-mb > 0 y finito')
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    raise SystemExit(0 if run(a.seconds,a.interval,a.output,a.pid,warmup_seconds=a.warmup_seconds,max_growth_mb=a.max_growth_mb) else 1)
