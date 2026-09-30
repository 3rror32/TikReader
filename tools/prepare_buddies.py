"""Prepare ImageGen atlases: remove connected matte and align four walk frames.

Python image processing explicitly authorized by the user on 2026-09-07.
Source art is retained; final strips are RGBA with transparent cell padding.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent


def prepare(source, theme):
    rgb = np.array(Image.open(source).convert('RGB'))
    # The generated matte consists of near-white, neutral checkerboard squares.
    # Flood from the canvas edges, preserving white highlights inside outlines.
    threshold, tolerance = (205, 24) if theme == 'fantasia' else (105, 35)
    candidate = (rgb.min(axis=2) >= threshold) & (np.ptp(rgb.astype(int), axis=2) < tolerance)
    seeds = np.zeros(candidate.shape, bool)
    seeds[0, :] = seeds[-1, :] = True
    seeds[:, 0] = seeds[:, -1] = True
    background = ndimage.binary_propagation(seeds & candidate, mask=candidate)
    alpha = np.where(background, 0, 255).astype('uint8')
    foreground = alpha > 0
    # Remove isolated matte/antialias specks, never full character components.
    labels, count = ndimage.label(foreground)
    sizes = np.bincount(labels.ravel())
    foreground &= sizes[labels] >= 100
    alpha[~foreground] = 0
    rgba = Image.fromarray(np.dstack([rgb, alpha]))
    height, width = alpha.shape
    # Locate row gutters rather than assume the generator obeyed exact cell sizes.
    density = (alpha > 0).sum(axis=1)
    boundaries = [0]
    for i in range(1, 10):
        center = round(height * i / 10)
        lo, hi = max(boundaries[-1] + 1, center - height // 25), min(height, center + height // 25)
        candidates = np.flatnonzero(density[lo:hi] == density[lo:hi].min()) + lo
        boundaries.append(int(candidates[np.argmin(abs(candidates - center))]))
    boundaries.append(height)
    out = ROOT / 'assets' / 'sprites' / 'walk'
    out.mkdir(parents=True, exist_ok=True)
    for row in range(10):
        frames = []
        for col in range(4):
            cell = rgba.crop((round(width * col / 4), boundaries[row], round(width * (col + 1) / 4), boundaries[row + 1]))
            bbox = cell.getbbox()
            if bbox is None:
                raise ValueError(f'Empty frame: {theme} {row} {col}')
            frames.append(cell.crop(bbox))
        scale = min(112 / max(f.width for f in frames), 112 / max(f.height for f in frames))
        strip = Image.new('RGBA', (512, 128))
        for col, frame in enumerate(frames):
            frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
            strip.alpha_composite(frame, (col * 128 + (128 - frame.width) // 2, 120 - frame.height))
        strip.save(out / f'{theme}-{row}.png', optimize=True)
    return dict(theme=theme, source=str(source), rows=10, frames=4, cell=128)


def contact_sheet():
    paths = sorted((ROOT / 'assets/sprites/walk').glob('*.png'))
    themes = sorted({p.stem.rsplit('-', 1)[0] for p in paths})
    sheet = Image.new('RGB', (1280, len(themes) * 155), '#26343d')
    draw = ImageDraw.Draw(sheet)
    for row, theme in enumerate(themes):
        draw.text((8, row * 155 + 3), theme, fill='white')
        for i in range(10):
            im = Image.open(ROOT / f'assets/sprites/walk/{theme}-{i}.png').crop((0, 0, 128, 128))
            sheet.paste(im, (i * 128, row * 155 + 22), im)
    sheet.save(ROOT / 'assets/sprites/walk-preview.png')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args()
    for entry in json.loads(args.manifest.read_text(encoding='utf-8')):
        print(prepare(entry['source'], entry['theme']))
    contact_sheet()
