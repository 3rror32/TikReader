"""Animal regressions check extracted artwork as well as moving joint traces."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest

spec = importlib.util.spec_from_file_location(
    "animal_generator", Path(__file__).resolve().parents[1] / "tools/anatomical_buddies.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
PROTOTYPES = {"dinosaurios-0": 2, "dinosaurios-1": 4, "mascotas-0": 4, "mascotas-4": 2}


def test_triceratops_does_not_carry_opaque_background_between_its_legs():
    source = np.array(generator.rig("dinosaurios-1")[0])
    lower = source[103:118, 57:67]
    neutral = np.ptp(lower[:, :, :3].astype(int), axis=2) < 10
    assert not (neutral & (lower[:, :, :3].min(axis=2) > 220) & (lower[:, :, 3] > 0)).any()


@pytest.mark.parametrize("key,region", [
    ("dinosaurios-0", (39, 105, 81)), ("dinosaurios-1", (35, 105, 108)),
    ("mascotas-0", (26, 102, 104)), ("mascotas-4", (48, 109, 106)),
    ("mascotas-4", (70, 104, 106)),
])
def test_torso_contains_no_stationary_calf_or_toe_outlines(key, region):
    left, top, right = region
    assert not generator.rig(key)[2][top:, left:right, 3].any()


@pytest.mark.parametrize("number", [3, 4, 7, 8])
def test_upright_pets_keep_their_held_forepaws_as_hands(number):
    assert generator.anatomy(f"mascotas-{number}") == "biped"


@pytest.mark.parametrize("key,count", PROTOTYPES.items())
def test_animal_limbs_are_unique_drawn_textures_and_torso_has_no_old_feet(key, count):
    source, _, torso, limbs, legs, _ = generator.rig(key)
    assert len(limbs) == len(legs) == count
    assert len({limb["layer"].tobytes() for limb in limbs}) == count
    masks = [limb["layer"][:, :, 3] > 0 for limb in limbs]
    for index, limb in enumerate(limbs):
        assert len(limb["points"]) == 4
        assert masks[index].sum() >= 20
        assert tuple(limb["root"]) != tuple(limbs[(index + 1) % count]["root"])
        for other in masks[index + 1:]:
            assert (masks[index] & other).sum() < min(masks[index].sum(), other.sum()) * .25
    # Pixel extraction must preserve all original texture colors and the body
    # outside the declared limb/exclusion regions, including tails and hands.
    removed = np.any(np.array(source) != torso, axis=2)
    union = np.logical_or.reduce([limb["mask"] > 0 for limb in limbs])
    assert not removed[~union].any()
    assert not torso[union, 3].any()
    for limb in limbs:
        assert np.array_equal(limb["layer"][limb["mask"] > 0], np.array(source)[limb["mask"] > 0])


@pytest.mark.parametrize("key,count", PROTOTYPES.items())
def test_animals_render_reachable_moving_paws_and_bipeds_pass_under_pelvis(monkeypatch, key, count):
    monkeypatch.setattr(generator, "save_sprite", lambda *args, **kwargs: None)
    frames, meta, traces = generator.build(key)
    assert meta["legs"] == count
    for index in range(count):
        bones = [[np.linalg.norm(np.array(frame[index][a]) - frame[index][b])
                  for a, b in (("root", "knee"), ("knee", "foot"))] for frame in traces]
        assert np.ptp(bones, axis=0).max() < .5
        supported = 0
        for image, trace in zip(frames, traces):
            leg = trace[index]
            if leg["support"]:
                x, y = np.rint(leg["paw"]).astype(int)
                supported += np.count_nonzero(np.array(image)[y-4:y+5, x-5:x+6, 3]) >= 8
        assert supported >= 6
        feet = np.array([frame[index]["foot"] for frame in traces])
        assert np.ptp(feet[:, 0]) >= 5
        assert np.ptp(feet[:, 1]) >= 2
        if count == 2:
            pelvis = np.mean([limb["root"][0] for limb in generator.rig(key)[3]])
            assert feet[:, 0].min() < pelvis < feet[:, 0].max()
