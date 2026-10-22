"""Fire-dragon anatomy and visible paw placement, not just joint equations."""
import importlib.util
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location(
    "dragon_generator", Path(__file__).resolve().parents[1] / "tools/anatomical_buddies.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


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
