"""Fire-dragon anatomy and visible paw placement, not just joint equations."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

spec = importlib.util.spec_from_file_location(
    "dragon_generator", Path(__file__).resolve().parents[1] / "tools/anatomical_buddies.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


@pytest.mark.parametrize("key", [f"fantasia-{i}" for i in range(10)])
def test_each_dragon_has_four_independent_textured_anatomical_chains(key):
    _, _, torso, limbs, _, _ = generator.rig(key)
    assert len(limbs) == 4, f"{key} still duplicates two generic source slices."
    assert {limb["name"] for limb in limbs} == {"far_hind", "far_fore", "near_hind", "near_fore"}
    masks = [limb["layer"][:, :, 3] > 0 for limb in limbs]
    for i, limb in enumerate(limbs):
        assert len(limb["points"]) == 4
        # A far limb may expose only its shin and paw behind the torso.
        assert masks[i].sum() >= 16, (key, limb["name"], "missing source limb texture")
        for other in masks[i + 1:]:
            assert (masks[i] & other).sum() < min(masks[i].sum(), other.sum()) * .3
    assert limbs[3]["root"][0] - limbs[2]["root"][0] > 20
    ankle_band = int(min(limb["points"][2][1] for limb in limbs)) - 1
    occupied = [np.argwhere(mask)[:, 1] for mask in masks]
    left, right = min(x.min() for x in occupied), max(x.max() for x in occupied) + 1
    assert not torso[ankle_band:, left:right, 3].any(), (key, "stationary source claws")


@pytest.mark.parametrize("key", [f"fantasia-{i}" for i in range(10)])
def test_each_dragon_renders_its_own_four_paw_regions(monkeypatch, key):
    monkeypatch.setattr(generator, "save_sprite", lambda *args, **kwargs: None)
    frames, _, tracks = generator.build(key)
    for limb in range(4):
        bones = [[np.linalg.norm(np.array(frame[limb][a])-frame[limb][b])
                  for a, b in (("root", "knee"), ("knee", "foot"))] for frame in tracks]
        assert np.ptp(bones, axis=0).max() < .5, (key, limb, "unreachable ankle stretches the limb")
        visible_support = 0
        for frame, trace in zip(frames, tracks):
            leg = trace[limb]
            if not leg["support"]:
                continue
            x, y = np.rint(leg.get("paw", leg["foot"])).astype(int)
            alpha = np.array(frame)[max(0, y-4):min(128, y+5), max(0, x-6):min(128, x+7), 3]
            visible_support += np.count_nonzero(alpha) >= 8
        assert visible_support >= 6, (key, limb, "paw never appears at its rendered support location")


def test_dragon_uses_four_distinct_drawn_limbs_and_separate_shoulder_hip_anchors():
    _, kind, _, limbs, _, _ = generator.rig("fantasia-0")
    assert kind == "quadruped"
    assert len(limbs) == 4, "Four visible dragon legs need four source cutouts, not two duplicated slices."
    assert len({limb["layer"].tobytes() for limb in limbs}) == 4
    centers = [np.argwhere(limb["layer"][:, :, 3] > 0).mean(axis=0)[1] for limb in limbs]
    assert len({round(center / 8) for center in centers}) == 4
    hind, fore = limbs[2], limbs[3]
    assert fore["root"][0] - hind["root"][0] > 25
    assert fore["root"][1] < hind["root"][1] - 4
    for limb in limbs:
        assert limb["layer"][:, :, 3].sum() > 255 * 20
        assert len(limb["points"]) == 4, "Each chain needs a shoulder/hip, elbow/knee, ankle and paw."


def test_four_paws_are_visible_in_the_rendered_contact_pose(monkeypatch):
    monkeypatch.setattr(generator, "save_sprite", lambda *args, **kwargs: None)
    frames, meta, _ = generator.build("fantasia-0")
    alpha = np.array(frames[0])[:, :, 3]
    # These are four separate paw regions in the original side-view drawing.
    # The old broad masks cropped away or merged several of these footprints.
    for left, right in ((35, 55), (59, 78), (78, 95), (98, 119)):
        assert np.count_nonzero(alpha[112:122, left:right]) >= 8, (left, right)
    assert meta["legs"] == 4


def test_torso_does_not_keep_stationary_toes_beside_articulated_paws():
    _, _, torso, limbs, _, _ = generator.rig("fantasia-0")
    # Derive the lower-leg region from the independently extracted artwork.
    # No support or swing leg is present in the torso-only alpha channel.
    ankle_band = int(min(limb["points"][2][1] for limb in limbs)) - 1
    occupied = [np.argwhere(limb["layer"][:, :, 3] > 0)[:, 1] for limb in limbs]
    left, right = min(x.min() for x in occupied), max(x.max() for x in occupied) + 1
    assert not torso[ankle_band:, left:right, 3].any(), "Old claws must move with their own limb, never remain on the torso."


@pytest.mark.parametrize("key", ["fantasia-4", "fantasia-6"])
def test_colored_dragon_does_not_animate_white_background_between_its_legs(monkeypatch, key):
    monkeypatch.setattr(generator, "save_sprite", lambda *args, **kwargs: None)
    frames, _, _ = generator.build(key)
    for frame in frames:
        lower = np.array(frame)[96:122]
        neutral = np.ptp(lower[:, :, :3].astype(int), axis=2) <= 5
        assert not (neutral & (lower[:, :, :3].min(axis=2) >= 225) & (lower[:, :, 3] > 0)).any()


def test_navy_background_exclusion_preserves_blue_and_gold_leg_texture():
    root = Path(__file__).resolve().parents[1]
    original = np.array(Image.open(root / "assets/sprites/walk/fantasia-4.png").convert("RGBA"))[:128, :128]
    cleaned = np.array(generator.rig("fantasia-4")[0])
    rgb = original[:, :, :3].astype(int)
    blue = (rgb[:, :, 2] > rgb[:, :, 0] + 15) & (rgb[:, :, 2] > rgb[:, :, 1])
    gold = (rgb[:, :, 0] > 150) & (rgb[:, :, 1] > 100) & (rgb[:, :, 2] < 100)
    colored = (blue | gold) & (original[:, :, 3] > 0)
    assert (cleaned[:, :, 3][colored] > 0).all()
