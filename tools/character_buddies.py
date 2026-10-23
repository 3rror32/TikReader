"""Individually fitted original-pixel character chains, including concealed boots."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/sprites/walk-v3'
FRAMES = 24


def config(key):
    return json.loads((DEST/'character-rigs.json').read_text())[key]


def supports(key):
    path = DEST/'character-rigs.json'
    return path.exists() and key in json.loads(path.read_text())


def rig(key):
    definition = config(key)
    source = Image.open(ROOT/f'assets/sprites/walk/{key}.png').convert('RGBA').crop((0,0,128,128))
    shift = 120-source.getbbox()[3]
    aligned = Image.new('RGBA',(128,128))
    aligned.alpha_composite(source,(0,shift))
    pixels = np.array(aligned)
    torso = pixels.copy()
    limbs = []
    for limb in definition['limbs']:
        points = np.array(limb['points'],dtype=float)+[0,shift]
        mask = np.zeros((128,128),dtype=np.uint8)
        cv2.fillPoly(mask,[np.array(limb['polygon'],dtype=np.int32)+[0,shift]],255)
        for left,top,right,bottom in [limb['foot_region'],*limb.get('outline_regions',[])]:
            mask[max(0,top+shift):min(128,bottom+shift),left:right] = 255
        layer = pixels.copy()
        layer[mask==0] = 0
        torso[mask>0] = 0
        root,knee,ankle,paw = points
        cap = limb.get('cap',6)
        sections = [root+[0,-cap],root,knee,ankle]
        nodes = [[point+[-24,0],point+[24,0]] for point in sections]
        bottom = np.flatnonzero(layer[:,:,3].any(axis=1))[-1]+1
        limbs.append({**limb,'points':points,'root':root,'foot':ankle,'layer':layer,'mask':mask,
                      'nodes':nodes,'baseline':120-bottom,
                      'lengths':[np.linalg.norm(knee-root),np.linalg.norm(ankle-knee)+120-bottom]})
    legs = [(i,limb['offset'],limb['far']) for i,limb in enumerate(limbs)]
    return aligned,definition['anatomy'],torso,limbs,legs,definition['stance']


def warp_limb(limb,root,knee,ankle,mesh_warp):
    # Every pixel at/below the fitted boot collar moves rigidly; knee mapping
    # affects only the original thigh/calf above it. No foot is reconstructed.
    cut = int(limb['foot'][1])
    upper = limb['layer'].copy()
    upper[cut:] = 0
    lower = limb['layer'].copy()
    lower[:cut] = 0
    sections = [root+[0,-limb.get('cap',6)],root,knee,ankle]
    targets = [[point+[-24,0],point+[24,0]] for point in sections]
    layer = mesh_warp(upper,limb['nodes'],targets)
    delta = np.rint(ankle-limb['foot'])
    foot = cv2.warpAffine(lower,np.float32([[1,0,delta[0]],[0,1,delta[1]]]),(128,128),flags=cv2.INTER_NEAREST)
    layer[foot[:,:,3]>0] = foot[foot[:,:,3]>0]
    return layer


def render(key,mesh_warp,solve_knee):
    source,kind,torso,limbs,legs,stance = rig(key)
    definition = config(key)
    amplitude,lift = definition['amplitude'],definition['lift']
    stride = 2*amplitude/stance
    pelvis = np.mean([limb['root'][0] for limb in limbs])
    frames,tracks = [],[]
    for frame in range(FRAMES):
        phase = frame/FRAMES
        if len(legs)==2:
            bob = definition['bob']+.6*math.sin(4*math.pi*phase)
            transfer = 0
        elif kind=='tripod':
            bob = definition['bob']+.2*(1-math.cos(6*math.pi*phase))
            transfer = .45*math.sin(2*math.pi*phase)
        else:
            bob = definition['bob']+.25*(1-math.cos(8*math.pi*phase))
            transfer = 0
        layers,trace = [],[]
        for index,offset,far in legs:
            limb = limbs[index]
            local = (phase+offset)%1
            if local<stance:
                dx,dy = amplitude-stride*local,0
            else:
                u = (local-stance)/(1-stance)
                velocity = -stride*(1-stance)
                dx = ((2*u**3-3*u*u+1)*(-amplitude)+(u**3-2*u*u+u)*velocity
                      +(-2*u**3+3*u*u)*amplitude+(u**3-u*u)*velocity)
                dy = -limb.get('lift',lift)*math.sin(math.pi*u)**2
            root = limb['root'].copy()+[transfer,bob+limb.get('root_drop',0)]
            if 'hip_spacing' in definition:
                root[0] = pelvis+(-.5 if index==0 else .5)*definition['hip_spacing']+transfer
            rest_x = pelvis if len(legs)==2 else limb['rest_x']
            ankle = np.array([rest_x+dx,limb['foot'][1]+limb['baseline']+dy])
            knee = solve_knee(root,ankle,limb['lengths'],limb['bend'])
            paw = ankle+limb['points'][3]-limb['foot']
            layers.append((far,warp_limb(limb,root,knee,ankle,mesh_warp)))
            trace.append(dict(name=limb['name'],root=root.tolist(),knee=knee.tolist(),foot=ankle.tolist(),
                              paw=paw.tolist(),support=local<stance,phase=local))
        canvas = Image.new('RGBA',(128,128))
        for far,layer in layers:
            if far:canvas.alpha_composite(Image.fromarray(layer))
        matrix = np.float32([[1,0,transfer],[0,1,bob]])
        canvas.alpha_composite(Image.fromarray(cv2.warpAffine(torso,matrix,(128,128),flags=cv2.INTER_NEAREST)))
        for far,layer in layers:
            if not far:canvas.alpha_composite(Image.fromarray(layer))
        frames.append(canvas)
        tracks.append(trace)
    return source,frames,dict(frames=FRAMES,stride=stride/128,anatomy=kind,legs=len(legs),
                              stance=stance,rig='explicit-character-limbs'),tracks


def build(key,save_sprite,mesh_warp,solve_knee):
    source,frames,metadata,tracks = render(key,mesh_warp,solve_knee)
    strip = Image.new('RGBA',(FRAMES*128,128))
    for index,frame in enumerate(frames):strip.alpha_composite(frame,(index*128,0))
    save_sprite(strip,DEST/f'{key}.png')
    save_sprite(source,DEST/f'{key}-idle.png')
    return frames,metadata,tracks
