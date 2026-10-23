"""Explicit dragon anatomy extracted from existing artwork, without repainting."""
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/sprites/walk-v3"
FRAMES = 24


def config(key):
    return json.loads((DEST / "dragon-rigs.json").read_text())[key]


def supports(key):
    return key in json.loads((DEST / "dragon-rigs.json").read_text())


def rig(key):
    definition = config(key)
    atlas = Image.open(ROOT / f"assets/sprites/walk/{key}.png").convert("RGBA")
    index = definition["source_pose"]
    source = atlas.crop((index * 128, 0, (index + 1) * 128, 128))
    shift = 120 - source.getbbox()[3]
    aligned = Image.new("RGBA", (128, 128))
    aligned.alpha_composite(source, (0, shift))
    pixels = np.array(aligned)
    # Remove only explicitly identified opaque background holes in source art.
    for polygon in definition.get("transparent_polygons", []):
        mask = np.zeros((128, 128), dtype=np.uint8)
        cv2.fillPoly(mask, [(np.array(polygon, dtype=np.int32) + [0, shift]).astype(np.int32)], 255)
        pixels[mask > 0] = 0
    aligned = Image.fromarray(pixels)
    torso = pixels.copy()
    specs = []
    for limb in definition["limbs"]:
        points = np.array(limb["points"], dtype=float) + [0, shift]
        polygon = np.array(limb["polygon"], dtype=np.int32) + [0, shift]
        mask = np.zeros((128, 128), dtype=np.uint8)
        cv2.fillPoly(mask, [polygon.astype(np.int32)], 255)
        layer = pixels.copy()
        layer[mask == 0] = 0
        baseline = 120 - (np.flatnonzero(layer[:, :, 3].any(axis=1))[-1] + 1) if definition.get("align_ground") else 0
        torso[mask > 0] = 0
        root, knee, ankle, paw = points
        sections = [root + [0, -6], root, knee, ankle, paw + [0, 3]]
        nodes = [[point + [-16, 0], point + [16, 0]] for point in sections]
        specs.append({**limb, "points": points, "root": root, "foot": ankle,
                      "layer": layer, "nodes": nodes, "baseline": baseline,
                      "lengths": [np.linalg.norm(knee-root), np.linalg.norm(ankle-knee)]})
    legs = [(i, limb["offset"], limb["far"]) for i, limb in enumerate(specs)]
    # The flattened source contains isolated claws just beyond the leg masks.
    # Below the belly this area belongs exclusively to legs, never the torso.
    left, top, right = definition.get("clear", [36, 108, 117])
    torso[top + shift:, left:right] = 0
    return aligned, "quadruped", torso, specs, legs, .75


def build(key, save_sprite, mesh_warp, solve_knee):
    source, kind, torso, specs, legs, stance = rig(key)
    definition = config(key)
    amplitude, lift = definition["amplitude"], definition["lift"]
    stride = 2 * amplitude / stance
    frames, tracks = [], []
    for frame in range(FRAMES):
        phase = frame / FRAMES
        # Small four-beat weight transfer, anchored to anatomical shoulders/hips.
        bob = definition.get("bob_base", 2) + definition.get("bob_amount", .45) * (1 - math.cos(8 * math.pi * phase))
        body_matrix = cv2.getRotationMatrix2D(tuple(definition.get("pivot", [75, 92])), definition.get("pitch", .65)*math.sin(4*math.pi*phase), 1)
        body_matrix[1, 2] += bob
        layers, trace = [], []
        for index, offset, far in legs:
            limb = specs[index]
            local = (phase + offset) % 1
            if local < stance:
                dx, dy = amplitude - stride * local, 0
            else:
                u = (local - stance) / (1 - stance)
                velocity = -stride * (1 - stance)
                dx = ((2*u**3-3*u*u+1)*(-amplitude) + (u**3-2*u*u+u)*velocity
                      + (-2*u**3+3*u*u)*amplitude + (u**3-u*u)*velocity)
                dy = -limb.get("lift", lift) * math.sin(math.pi*u)**2
            root = body_matrix @ np.append(limb["root"], 1)
            ankle = np.array([limb["rest_x"] + dx, limb["foot"][1] + limb["baseline"] + dy])
            knee = solve_knee(root, ankle, limb["lengths"], limb["bend"])
            paw = ankle + limb["points"][3] - limb["foot"]
            sections = [root + [0, -6], root, knee, ankle, paw + [0, 3]]
            targets = [[point + [-16, 0], point + [16, 0]] for point in sections]
            layer = mesh_warp(limb["layer"], limb["nodes"], targets)
            # Source far legs already carry their own shading and silhouette.
            layers.append((far, layer))
            trace.append(dict(name=limb["name"], root=root.tolist(), knee=knee.tolist(),
                              foot=ankle.tolist(), paw=paw.tolist(), support=local < stance, phase=local))
        canvas = Image.new("RGBA", (128, 128))
        for far, layer in layers:
            if far:
                canvas.alpha_composite(Image.fromarray(layer))
        body = cv2.warpAffine(torso, body_matrix, (128, 128), flags=cv2.INTER_NEAREST)
        canvas.alpha_composite(Image.fromarray(body))
        for far, layer in layers:
            if not far:
                canvas.alpha_composite(Image.fromarray(layer))
        frames.append(canvas)
        tracks.append(trace)
    strip = Image.new("RGBA", (FRAMES * 128, 128))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * 128, 0))
    save_sprite(strip, DEST / f"{key}.png")
    save_sprite(source, DEST / f"{key}-idle.png")
    return frames, dict(frames=FRAMES, stride=stride/128, anatomy=kind, legs=4,
                        stance=stance, rig="explicit-four-limb"), tracks
