"""Behavioral walk contracts, independent of generated sprite snapshots."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest


spec = importlib.util.spec_from_file_location(
    "anatomical_buddies", Path(__file__).resolve().parents[1] / "tools/anatomical_buddies.py"
)
gait = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gait)


@pytest.fixture
def cycle(monkeypatch):
    # Inspect real poses without publishing any generated asset from a unit test.
    monkeypatch.setattr(gait, "save_sprite", lambda *args, **kwargs: None)
    return gait.build


@pytest.mark.parametrize("character", ["chibis-2", "dinosaurios-0", "cyborgs-0"])
def test_biped_pelvis_descends_after_contact_then_rises_before_next_contact(cycle, character):
    _, _, tracks = cycle(character)
    contact, down, passing, up, next_contact = [tracks[i][0]["root"][1] for i in (0, 3, 6, 9, 12)]
    assert down > contact, "The weight-bearing knee must absorb landing after contact."
    assert down > passing > up, "The pelvis rises through passing into the up pose."
    assert up < next_contact, "The highest pelvis position precedes the next contact."
    assert contact == pytest.approx(next_contact)


@pytest.mark.parametrize("character", ["mascotas-0", "fantasia-0", "dinosaurios-1", "cyborgs-6"])
def test_quadruped_walk_uses_lateral_four_beat_touchdowns(cycle, character):
    _, meta, tracks = cycle(character)
    # Layer order: far hind, far fore, near hind, near fore. A lateral walk
    # places the fore paw after the hind paw on the same side, then changes side.
    touchdowns = []
    for frame, legs in enumerate(tracks):
        previous = tracks[frame - 1]
        touchdowns.extend((frame, limb) for limb, leg in enumerate(legs)
                          if leg["support"] and not previous[limb]["support"])
    assert touchdowns == [(0, 0), (6, 1), (12, 2), (18, 3)]
    assert meta["legs"] == 4
    assert min(sum(leg["support"] for leg in frame) for frame in tracks) == 3


@pytest.mark.parametrize("character", ["chibis-2", "mascotas-0", "dinosaurios-1", "cyborgs-6"])
def test_planted_feet_counter_world_motion_and_swing_clears_ground(cycle, character):
    _, meta, tracks = cycle(character)
    for limb in range(meta["legs"]):
        planted = [frame[limb] for frame in tracks if frame[limb]["support"]]
        ground = planted[0]["foot"][1]
        assert all(leg["foot"][1] == pytest.approx(ground) for leg in planted)
        assert min(frame[limb]["foot"][1] for frame in tracks) < ground - 1
        for a, b in zip(tracks, tracks[1:]):
            a, b = a[limb], b[limb]
            if a["support"] and b["support"] and b["phase"] > a["phase"]:
                assert b["foot"][0] - a["foot"][0] == pytest.approx(-meta["stride"] * 128 / gait.FRAMES)
        lengths = [[np.linalg.norm(np.array(frame[limb][a]) - frame[limb][b])
                    for a, b in (("root", "knee"), ("knee", "foot"))] for frame in tracks]
        assert np.ptp(lengths, axis=0).max() < .5
