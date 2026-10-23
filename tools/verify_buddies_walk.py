"""Offline checks for every generated gait, beyond mere frame differences."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'assets/sprites/walk-v3'


def main():
    meta=json.loads((DEST/'manifest.json').read_text())
    traces=json.loads((DEST/'joint-tracks.json').read_text())
    report=[]
    for key,gait in meta.items():
        im=Image.open(DEST/f'{key}.png')
        count=gait['frames']
        assert im.mode=='RGBA' and im.size==(count*128,128),key
        frames=[np.array(im.crop((i*128,0,(i+1)*128,128))) for i in range(count)]
        assert len({f.tobytes() for f in frames})>=min(16,count),key
        for f in frames:
            assert not f[:2,:,3].any() and not f[-2:,:,3].any(),key
            assert not f[:,:2,3].any() and not f[:,-2:,3].any(),key
            assert (f[:,:,3]==0).any() and (f[:,:,3]==255).any(),key
            assert np.flatnonzero(f[:,:,3].any(axis=1))[-1]>=116,(key,'sprite above ground')
        changes=[np.mean(np.any(frames[i]!=frames[(i+1)%count],axis=2)) for i in range(count)]
        assert changes[-1]<=max(changes[:-1])*1.15+.002,(key,'loop seam')
        if gait.get('authored'):
            report.append(dict(character=key,frames=count,authored=True,validation='RGBA, bounds and visual pose review; no synthetic joint trace'))
            continue
        trace=traces[key]
        assert len(trace)==count,(key,'trace frame count')
        if gait['anatomy']=='biped':
            contact,down,passing,up=[trace[i][0]['root'][1] for i in (0,3,6,9)]
            assert down>contact and down>passing>up and up<contact,(key,'pelvis pose order')
            separation=[f[0]['foot'][0]-f[1]['foot'][0] for f in trace]
            assert min(separation)<0<max(separation),(key,'feet never pass')
        if gait['legs']==4:
            touchdowns=[(i,leg) for i,frame in enumerate(trace) for leg,p in enumerate(frame)
                        if p['support'] and not trace[i-1][leg]['support']]
            assert touchdowns==[(0,0),(6,1),(12,2),(18,3)],(key,'lateral footfall order')
        if gait['anatomy']=='tripod':
            assert gait['legs']==3 and gait['stance']==.75,(key,'tripod anatomy')
            touchdowns=[(i,leg) for i,frame in enumerate(trace) for leg,p in enumerate(frame)
                        if p['support'] and not trace[i-1][leg]['support']]
            assert touchdowns==[(0,0),(8,1),(16,2)],(key,'serial tripod footfall order')
        supports=[sum(leg['support'] for leg in frame) for frame in trace]
        assert min(supports)>=(3 if gait['legs']==4 else 2 if gait['legs']==3 else 1),(key,'airborne walk')
        max_drift=0.
        for leg in range(gait['legs']):
            bones=np.array([[np.linalg.norm(np.array(f[leg]['root'])-f[leg]['knee']),np.linalg.norm(np.array(f[leg]['foot'])-f[leg]['knee'])] for f in trace])
            assert np.ptp(bones,axis=0).max()<.5,(key,'stretching limb')
            support=[(i,f[leg]) for i,f in enumerate(trace) if f[leg]['support']]
            assert np.ptp([p['foot'][1] for _,p in support])<.001,(key,'floating foot')
            for (i,p),(j,q) in zip(support,support[1:]):
                if j==i+1 and q['phase']>p['phase']:
                    drift=abs(q['foot'][0]-p['foot'][0]+gait['stride']*128/count)
                    max_drift=max(max_drift,drift)
                    assert drift<.001,(key,'sliding planted foot')
            assert any(not f[leg]['support'] for f in trace),(key,'leg never swings')
        report.append(dict(character=key,anatomy=gait['anatomy'],legs=gait['legs'],frames=count,min_supports=min(supports),planted_foot_drift=round(max_drift,6),loop_seam=round(changes[-1],5)))
    (DEST/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'{len(report)} cycles passed: {sum(g["frames"] for g in meta.values())} RGBA frames, pose order, support, fixed bone lengths, planted feet and loop continuity.')


if __name__=='__main__':main()
