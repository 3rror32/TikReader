"""Build consistent eight-pose cutout walk cycles from the approved pixel art.

Uses one canonical drawing: head, costume and proportions cannot morph between
frames. Lower limbs hinge at a fixed hip, with separate stance and lifted swing.
Python sprite preparation was explicitly authorized by the user.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
FRAMES = 8


def cycle(source):
    im = Image.open(source).convert('RGBA').crop((0, 0, 128, 128))
    a = np.array(im)
    x0, y0, x1, y1 = im.getbbox()
    theme = source.stem.rsplit('-', 1)[0]
    quadruped = theme in ('fantasia', 'mascotas', 'dinosaurios')
    hip = y1 - max(12, round((y1-y0) * (.23 if quadruped else .30)))
    # Find foot contacts, ignoring disconnected sparks and particles.
    contacts = (a[y1-7:y1, :, 3] > 0).sum(axis=0).astype(float)
    contacts = ndimage.gaussian_filter1d(contacts, 2)
    left = int(np.argmax(contacts))
    masked = contacts.copy()
    masked[max(0, left-15):min(128, left+16)] = 0
    right = int(np.argmax(masked))
    if masked[right] < .5:
        left, right = max(x0+5, left-8), min(x1-5, left+8)
    left, right = sorted((left, right))
    split = (left+right)//2
    yy, xx = np.indices((128, 128))
    # Restrict the hinges to the feet's columns; tails/wings remain fixed.
    legmask = yy >= hip
    groups = [legmask & (xx <= split), legmask & (xx > split)]
    torso = a.copy()
    torso[legmask] = 0
    amplitude = min(9, max(5, (y1-hip)*.35))
    frames = []
    for f in range(FRAMES):
        canvas = Image.fromarray(torso)
        # Alternating legs, each planted for half a cycle. During stance the
        # foot travels backwards at constant speed relative to the torso.
        for side, mask in enumerate(groups):
            phase = (f/FRAMES + side*.5) % 1
            if phase < .5:
                shift, lift = amplitude*(1-4*phase), 0
            else:
                t = (phase-.5)*2
                shift, lift = amplitude*(-1+2*t), -5*np.sin(np.pi*t)
            limb = a.copy()
            limb[~mask] = 0
            # Inverse nearest-neighbour warp keeps the hip attached and the
            # pixel edges crisp; no independent recentering of frames.
            length = max(1, y1-hip-2)
            source_y = hip + (yy-hip)/(1+lift/length)
            source_weight = np.clip((source_y-hip)/length, 0, 1)
            sy = np.clip(np.rint(source_y).astype(int), 0, 127)
            sx = np.clip(np.rint(xx-shift*source_weight).astype(int), 0, 127)
            warped = limb[sy, sx]
            canvas.alpha_composite(Image.fromarray(warped))
        frames.append(canvas)
    strip = Image.new('RGBA', (128*FRAMES, 128))
    for f, frame in enumerate(frames):
        strip.alpha_composite(frame, (128*f, 0))
    return strip, frames, dict(frames=FRAMES, stride=4*amplitude/128, hip=hip, feet=[left,right])


def main():
    dest = ROOT/'assets/sprites/walk-v2'
    dest.mkdir(exist_ok=True)
    metadata = {}
    samples = []
    for source in sorted((ROOT/'assets/sprites/walk').glob('*.png')):
        strip, frames, info = cycle(source)
        strip.save(dest/source.name, optimize=True)
        metadata[source.stem] = info
        if source.stem in ('fantasia-0','cyborgs-0','mascotas-0','chibis-0'):
            samples.append((source.stem, strip, frames))
    (dest/'manifest.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    (ROOT/'web/static/buddies_walk_metadata.js').write_text('globalThis.BUDDY_WALK_METADATA='+json.dumps(metadata)+';\n', encoding='utf-8')
    board = Image.new('RGB', (1024, len(samples)*150), '#26343d')
    draw = ImageDraw.Draw(board)
    for row, (name, strip, _) in enumerate(samples):
        draw.text((8,row*150+2), name, fill='white')
        board.paste(strip, (0,row*150+20), strip)
    board.save(dest/'poses.png')
    movie=[]
    for f in range(FRAMES):
        frame=Image.new('RGB',(512,170),'#26343d')
        for col,(name,_,frames) in enumerate(samples):
            frame.paste(frames[f],(col*128,25),frames[f])
            ImageDraw.Draw(frame).text((col*128+8,5),name,fill='white')
        movie.append(frame)
    movie[0].save(dest/'walk-review.gif', save_all=True, append_images=movie[1:], duration=100, loop=0)
    print(f'Built {len(metadata)} fixed-anchor eight-frame cycles')


if __name__ == '__main__':
    main()
