"""Anatomy-aware pixel cutout cycles and review materials for all 80 buddies.

The user authorized Python sprite preparation. Preserve v1/v2; publish v3 only
after inspecting the contact sheets and checking every gait's support pattern.
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT/'assets/sprites/walk-v3'
FRAMES = 24
SIZE = 128


def anatomy(key):
    theme, number = key.rsplit('-', 1)
    number = int(number)
    if theme in ('fantasia', 'mascotas'):
        return 'quadruped'
    if theme == 'dinosaurios':
        return 'quadruped' if number in (1, 2, 3, 5) else 'biped'
    if theme == 'cyborgs' and number == 6:
        return 'quadruped'
    if theme == 'cyborgs' and number == 9:
        return 'quadruped'
    if (theme == 'elfos' and number in (1, 3, 4, 9)) or (theme == 'chibis' and number == 1):
        return 'robed'
    if theme == 'monstruos' and number == 0:
        return 'soft_biped'
    return 'biped'


def solve_knee(root, foot, lengths, bend):
    delta = foot-root
    dist = np.linalg.norm(delta)
    l1, l2 = lengths
    direction = delta/max(dist, .001)
    along = (dist*dist+l1*l1-l2*l2)/(2*max(dist,.001))
    height = math.sqrt(max(0, l1*l1-along*along))
    normal = np.array([direction[1], -direction[0]])
    return root+direction*along+normal*height*bend


def mesh_warp(layer, source_nodes, target_nodes):
    """Piecewise affine texture mapping: thigh, knee, shin, ankle and rigid foot."""
    result = np.zeros_like(layer)
    # Horizontal cross-sections keep the ankle/foot from stretching into spikes.
    for row in range(len(source_nodes)-1):
        for a, b, c in ((0, 1, 2), (1, 3, 2)):
            src_quad = [source_nodes[row][0], source_nodes[row][1], source_nodes[row+1][0], source_nodes[row+1][1]]
            dst_quad = [target_nodes[row][0], target_nodes[row][1], target_nodes[row+1][0], target_nodes[row+1][1]]
            src = np.float32([src_quad[a], src_quad[b], src_quad[c]])
            dst = np.float32([dst_quad[a], dst_quad[b], dst_quad[c]])
            matrix = cv2.getAffineTransform(src, dst)
            pixels = cv2.warpAffine(layer, matrix, (SIZE, SIZE), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT)
            mask = np.zeros((SIZE, SIZE), np.uint8)
            cv2.fillConvexPoly(mask, np.rint(dst).astype(np.int32), 255)
            select = (mask>0) & (pixels[:,:,3]>0)
            result[select] = pixels[select]
    return result


def rig(key):
    base=DEST/f'base/{key}.png'
    source = Image.open(base if base.exists() else ROOT/f'assets/sprites/walk/{key}.png').convert('RGBA').crop((0,0,128,128))
    image = np.array(source)
    components,_=ndimage.label(image[:,:,3]>0)
    areas=np.bincount(components.ravel())
    image[areas[components]<7]=0
    cleaned=Image.fromarray(image)
    source=Image.new('RGBA',(128,128))
    source.alpha_composite(cleaned,(0,120-cleaned.getbbox()[3]))
    image=np.array(source)
    kind = anatomy(key)
    x0,y0,x1,y1 = source.getbbox()
    # Foot contacts are measured separately from tail/wing outlines.
    contacts = (image[y1-6:y1,:,3]>0).sum(axis=0).astype(float)
    smoothed = ndimage.gaussian_filter1d(contacts, 1.5)
    runs, _ = ndimage.label(smoothed>max(.4,smoothed.max()*.22))
    peaks=[]
    for label in range(1,runs.max()+1):
        indexes=np.flatnonzero(runs==label)
        if len(indexes)>=3:
            peaks.append(int(indexes[np.argmax(smoothed[indexes])]))
    if len(peaks)<2:
        center=int(np.argmax(smoothed))
        peaks=[center-7,center+7]
    left,right=peaks[0],peaks[-1]
    # The walking pose is not a horizontal slice of the animal. Each source
    # limb gets its own tapered mask around an explicit hip/knee/foot chain.
    fraction=.35 if kind=='quadruped' else .27
    hip=y1-max(14,round((y1-y0)*fraction))
    if kind=='robed':
        hip=y1-12
    if key=='cyborgs-6':
        hip=76;left,right=25,104
    split=(left+right)//2
    specs=[]
    for index, foot_x in enumerate((left,right)):
        start=x0 if index==0 else split+1
        end=split if index==0 else x1
        root_x=foot_x + (3 if index==0 else -3)
        knee_y=hip+(y1-hip-5)*.52
        bend=1 if kind!='quadruped' or index==0 else -1
        knee_x=root_x+bend*3
        ankle_y=y1-5
        if key=='cyborgs-6':
            root_x=(55,77)[index];knee_x=(37,95)[index];knee_y=96;ankle_y=115
        root=np.array([root_x,hip],float)
        knee=np.array([knee_x,knee_y],float)
        foot=np.array([foot_x,ankle_y],float)
        half_top=min(10,max(5,(end-start)*.35))
        if kind=='quadruped':
            start=max(start,foot_x-9);end=min(end,foot_x+10)
            half_top=9
        polygon=np.int32([[max(x0,root_x-half_top),hip], [min(x1,root_x+half_top),hip],
                          [end,y1+1],[start,y1+1]])
        mask=np.zeros((128,128),np.uint8)
        cv2.fillConvexPoly(mask,polygon,255)
        layer=image.copy();layer[mask==0]=0
        foot_bottom=int(np.flatnonzero(layer[:,:,3].any(axis=1))[-1])+1
        baseline_adjust=y1-foot_bottom
        foot[1]=foot_bottom-5
        lengths=[float(np.linalg.norm(knee-root)),float(np.linalg.norm(foot-knee))+baseline_adjust]
        # Include an attachment overlap so rotation cannot expose a torso seam.
        nodes=[]
        for point in (root,knee,foot,np.array([foot_x,foot_bottom+1.])):
            nodes.append([point+[-26,0],point+[26,0]])
        specs.append(dict(root=root,knee=knee,foot=foot,lengths=lengths,baseline_adjust=baseline_adjust,bend=bend,layer=layer,mask=mask,nodes=nodes))
    torso=image.copy()
    for spec in specs:
        torso[spec['mask']>0]=0
    if kind=='quadruped':
        belly=y1-max(7,round((y1-y0)*.13))
        torso[belly:,max(0,left-13):min(128,right+14)]=0
    if key=='cyborgs-6':
        torso[hip:]=0
    # Two visible legs produce near/far articulated layers for four-legged art.
    if kind=='quadruped':
        legs=[(0,.0,True),(1,.25,True),(0,.5,False),(1,.75,False)]
        stance=.75
    elif kind=='tripod':
        legs=[(0,0,True),(1,1/3,True),(0,2/3,False)]
        stance=.75
    else:
        legs=[(0,0,True),(1,.5,False)]
        stance=.625
    return source,kind,torso,specs,legs,stance


def build(key):
    source,kind,torso,specs,legs,stance=rig(key)
    leg_height=specs[0]['foot'][1]-specs[0]['root'][1]
    amplitude=min(7.,max(2.,leg_height*.22))
    if kind=='robed':
        amplitude=2.5
    if key=='cyborgs-6':
        amplitude=3.
    lift=min(6.,max(2.,leg_height*.25))
    stride=2*amplitude/stance
    frames=[];tracks=[]
    for frame in range(FRAMES):
        phase=frame/FRAMES
        # A walk has no aerial bounce: slight pelvis motion, then independently
        # solved legs keep the supporting toes on the same ground line.
        bob=2+(.65 if kind=='quadruped' else 1.0)*(1-math.cos(4*math.pi*phase))
        torso_shift=np.array([0.,bob])
        back=[];front=[];track=[]
        for index,offset,far in legs:
            spec=specs[index]
            t=(phase+offset)%1
            if t<stance:
                dx=amplitude-stride*t
                dy=0.
            else:
                u=(t-stance)/(1-stance)
                # Hermite swing preserves velocity at contact/toe-off; a
                # squared sine lift has zero vertical speed at both ends.
                v=-stride*(1-stance)
                dx=(2*u**3-3*u*u+1)*(-amplitude)+(u**3-2*u*u+u)*v+(-2*u**3+3*u*u)*amplitude+(u**3-u*u)*v
                dy=-lift*math.sin(math.pi*u)**2
            depth=np.array([-3.,-1.]) if far else np.zeros(2)
            root=spec['root']+torso_shift+depth
            foot=spec['foot']+np.array([dx,dy+spec['baseline_adjust']])+depth
            if key=='cyborgs-6' and far:
                foot[0]+=18 if index==0 else -18
            knee=solve_knee(root,foot,spec['lengths'],spec['bend'])
            targets=[[point+[-26,0],point+[26,0]] for point in (root,knee,foot,foot+[0,6])]
            layer=mesh_warp(spec['layer'],spec['nodes'],targets)
            if far:
                layer[:,:,:3]=(layer[:,:,:3].astype(float)*.78).astype(np.uint8)
            (back if far else front).append(layer)
            track.append(dict(foot=foot.tolist(),root=root.tolist(),knee=knee.tolist(),support=t<stance,phase=t))
        canvas=Image.new('RGBA',(128,128))
        for layer in back:
            canvas.alpha_composite(Image.fromarray(layer))
        torso_frame=cv2.warpAffine(torso,np.float32([[1,0,0],[0,1,bob]]),(128,128),flags=cv2.INTER_NEAREST)
        canvas.alpha_composite(Image.fromarray(torso_frame))
        for layer in front:
            canvas.alpha_composite(Image.fromarray(layer))
        frames.append(canvas);tracks.append(track)
    strip=Image.new('RGBA',(128*FRAMES,128))
    for f,im in enumerate(frames):strip.alpha_composite(im,(f*128,0))
    strip.save(DEST/f'{key}.png',optimize=True)
    source.save(DEST/f'{key}-idle.png',optimize=True)
    return frames,dict(frames=FRAMES,stride=stride/128,anatomy=kind,legs=len(legs),stance=stance),tracks


def main():
    DEST.mkdir(exist_ok=True)
    manifest={};tracks={};all_frames={}
    for path in sorted((ROOT/'assets/sprites/walk').glob('*.png')):
        overrides=json.loads((DEST/'authored-overrides.json').read_text()) if (DEST/'authored-overrides.json').exists() else {}
        if path.stem in overrides:
            meta=overrides[path.stem]
            strip=Image.open(DEST/f'{path.stem}.png')
            frames=[strip.crop((i*128,0,(i+1)*128,128)) for i in range(meta['frames'])]
            trace=[]
        else:
            frames,meta,trace=build(path.stem)
        manifest[path.stem]=meta;tracks[path.stem]=trace;all_frames[path.stem]=frames
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    (ROOT/'web/static/buddies_walk_metadata.js').write_text('globalThis.BUDDY_WALK_METADATA='+json.dumps(manifest)+';\n',encoding='utf-8')
    (DEST/'joint-tracks.json').write_text(json.dumps(tracks),encoding='utf-8')
    themes=sorted({key.rsplit('-',1)[0] for key in manifest})
    for theme in themes:
        board=Image.new('RGB',(128*8,150*10),'#26343d');draw=ImageDraw.Draw(board)
        for row in range(10):
            key=f'{theme}-{row}'
            draw.text((5,row*150+2),key+' / '+manifest[key]['anatomy'],fill='white')
            for col,f in enumerate(range(0,FRAMES,3)):
                im=all_frames[key][round(f/FRAMES*len(all_frames[key]))%len(all_frames[key])];board.paste(im,(128*col,row*150+20),im)
        board.save(DEST/f'review-{theme}.png')
    # Real-time review in a browser: individual cycles, adjustable speed,
    # source drawings, single-step, and both directions. No streaming data.
    (DEST/'review-data.js').write_text('globalThis.REVIEW_DATA='+json.dumps(manifest)+';',encoding='utf-8')
    print(f'Prepared {len(manifest)} anatomy-specific cycles with {FRAMES} frames each.')


if __name__=='__main__':main()
