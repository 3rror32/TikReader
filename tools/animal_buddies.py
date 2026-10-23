"""Source-textured animal rigs with explicit limb silhouettes and anatomical roots."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/sprites/walk-v3"
FRAMES = 24


def config(key):
    return json.loads((DEST / "animal-rigs.json").read_text())[key]


def supports(key):
    path = DEST / "animal-rigs.json"
    return path.exists() and key in json.loads(path.read_text())


def rig(key):
    definition = config(key)
    atlas = Image.open(ROOT / f"assets/sprites/walk/{key}.png").convert("RGBA")
    pose = definition["source_pose"]
    pixels = np.array(atlas.crop((pose * 128, 0, (pose + 1) * 128, 128)))
    # A neighboring oversized dinosaur pose intrudes into the left edge of
    # several atlas cells. Keep the animal's connected silhouette only.
    if definition.get("remove_neighbor_fragment"):
        components, _ = ndimage.label(pixels[:, :, 3] > 0)
        areas = np.bincount(components.ravel())
        areas[0] = 0
        pixels[components != areas.argmax()] = 0
    # Only this inspected Triceratops hole is background. White pet fur and
    # dinosaur teeth/claws retain their original pixels and colors.
    for polygon in definition.get("background_holes", []):
        hole = np.zeros((128, 128), dtype=np.uint8)
        cv2.fillPoly(hole, [np.array(polygon, dtype=np.int32)], 255)
        rgb = pixels[:, :, :3].astype(int)
        white = (np.ptp(rgb, axis=2) < 10) & (rgb.min(axis=2) > 220)
        pixels[(hole > 0) & white] = 0
    source = Image.fromarray(pixels)
    shift = 120 - source.getbbox()[3]
    aligned = Image.new("RGBA", (128, 128))
    aligned.alpha_composite(source, (0, shift))
    pixels = np.array(aligned)
    torso = pixels.copy()
    limbs = []
    for limb in definition["limbs"]:
        points = np.array(limb["points"], dtype=float) + [0, shift]
        mask = np.zeros((128, 128), dtype=np.uint8)
        cv2.fillPoly(mask, [np.array(limb["polygon"], dtype=np.int32) + [0, shift]], 255)
        # Include every original toe/outline in its own limb, including the
        # one-pixel dark edges that extend beyond the main calf silhouette.
        left, top, right, bottom = limb["foot_region"]
        mask[top+shift:bottom+shift, left:right] = 255
        layer = pixels.copy()
        layer[mask == 0] = 0
        torso[mask > 0] = 0
        root, knee, ankle, paw = points
        top = limb.get("cap", 6)
        sections = [root + [0, -top], root, knee, ankle, paw + [0, 4]]
        nodes = [[point + [-20, 0], point + [20, 0]] for point in sections]
        bottom = np.flatnonzero(layer[:, :, 3].any(axis=1))[-1] + 1
        limbs.append({**limb, "points": points, "root": root, "foot": ankle,
                      "layer": layer, "mask": mask, "nodes": nodes, "baseline": 120-bottom,
                      "lengths": [np.linalg.norm(knee-root), np.linalg.norm(ankle-knee) + 120-bottom]})
    legs = [(index, limb["offset"], limb["far"]) for index, limb in enumerate(limbs)]
    return aligned, definition["anatomy"], torso, limbs, legs, definition["stance"]


def render(key, mesh_warp, solve_knee):
    source, kind, torso, limbs, legs, stance = rig(key)
    definition = config(key)
    amplitude, lift = definition["amplitude"], definition["lift"]
    stride = 2 * amplitude / stance
    pelvis = np.mean([limb["root"][0] for limb in limbs])
    frames, tracks = [], []
    for frame in range(FRAMES):
        phase = frame / FRAMES
        # Biped contact/down/passing/up; quadrupeds transfer weight four times.
        bob = (definition["bob"] + .6*math.sin(4*math.pi*phase) if kind == "biped"
               else definition["bob"] + .3*(1-math.cos(8*math.pi*phase)))
        matrix = np.float32([[1, 0, 0], [0, 1, bob]])
        layers, trace = [], []
        for index, offset, far in legs:
            limb = limbs[index]
            local = (phase + offset) % 1
            if local < stance:
                dx, dy = amplitude-stride*local, 0
            else:
                u = (local-stance)/(1-stance)
                velocity = -stride*(1-stance)
                dx = ((2*u**3-3*u*u+1)*(-amplitude) + (u**3-2*u*u+u)*velocity
                      + (-2*u**3+3*u*u)*amplitude + (u**3-u*u)*velocity)
                dy = -limb.get("lift", lift)*math.sin(math.pi*u)**2
            root = limb["root"] + [0, bob]
            if "hip_spacing" in definition:
                root[0] = pelvis + (-.5 if far else .5)*definition["hip_spacing"]
            rest_x = pelvis if kind == "biped" else limb["rest_x"]
            ankle = np.array([rest_x+dx, limb["foot"][1]+limb["baseline"]+dy])
            knee = solve_knee(root, ankle, limb["lengths"], limb["bend"])
            paw = ankle + limb["points"][3] - limb["foot"]
            sections = [root + [0, -limb.get("cap", 6)], root, knee, ankle, paw + [0, 4]]
            targets = [[point + [-20, 0], point + [20, 0]] for point in sections]
            layers.append((far, mesh_warp(limb["layer"], limb["nodes"], targets)))
            trace.append(dict(name=limb["name"], root=root.tolist(), knee=knee.tolist(),
                              foot=ankle.tolist(), paw=paw.tolist(), support=local < stance, phase=local))
        canvas = Image.new("RGBA", (128, 128))
        for far, layer in layers:
            if far:
                canvas.alpha_composite(Image.fromarray(layer))
        canvas.alpha_composite(Image.fromarray(cv2.warpAffine(torso, matrix, (128, 128), flags=cv2.INTER_NEAREST)))
        for far, layer in layers:
            if not far:
                canvas.alpha_composite(Image.fromarray(layer))
        frames.append(canvas)
        tracks.append(trace)
    return source, frames, dict(frames=FRAMES, stride=stride/128, anatomy=kind,
                               legs=len(legs), stance=stance, rig="explicit-animal-limbs"), tracks


def build(key, save_sprite, mesh_warp, solve_knee):
    source, frames, metadata, tracks = render(key, mesh_warp, solve_knee)
    strip = Image.new("RGBA", (FRAMES*128, 128))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index*128, 0))
    save_sprite(strip, DEST / f"{key}.png")
    save_sprite(source, DEST / f"{key}-idle.png")
    return frames, metadata, tracks
