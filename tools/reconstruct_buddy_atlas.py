"""Reconstruct a four-pose horizontal ImageGen strip as a 512x128 RGBA atlas."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ATLAS_SIZE = (512, 128)
CELL_SIZE = (128, 128)
BASELINE = 120
ALPHA_THRESHOLD = 64


def reconstruct(source: Path, destination: Path) -> list[tuple[int, int, int, int]]:
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    # Some image models return odd widths such as 2170px; divide those into
    # four near-equal columns with boundaries rounded down.
    poses: list[Image.Image] = []
    bounds: list[tuple[int, int, int, int]] = []
    for index in range(4):
        x_offset = index * width // 4
        x_end = (index + 1) * width // 4
        cell_width = x_end - x_offset
        region = image.crop((x_offset, 0, x_end, height))
        mask = region.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
        bbox = mask.getbbox()
        if bbox is None:
            raise ValueError(f"Pose {index + 1} contains no significant alpha pixels")

        left, top, right, bottom = bbox
        # Reject layouts where a character reaches a cell edge: equal-width slicing
        # would otherwise cut it, making the pose boundaries ambiguous.
        if left < 2 or right > cell_width - 2:
            raise ValueError(f"Pose {index + 1} touches a horizontal cell boundary")

        # Keep nearby antialiasing while ignoring low-alpha generation haze far
        # outside the character silhouette.
        crop_box = (
            max(0, left - 2),
            max(0, top - 2),
            min(cell_width, right + 2),
            min(height, bottom + 2),
        )
        pose = region.crop(crop_box)
        poses.append(pose)
        bounds.append((x_offset + left, top, right, bottom))

    bottoms = [bottom for _, _, _, bottom in bounds]
    if max(bottoms) - min(bottoms) > max(8, round(height * 0.02)):
        raise ValueError(f"Pose baselines vary too much to align safely: {bottoms}")

    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    for index, pose in enumerate(poses):
        scale = min(CELL_SIZE[0] / pose.width, BASELINE / pose.height)
        size = (max(1, round(pose.width * scale)), max(1, round(pose.height * scale)))
        fitted = pose.resize(size, Image.Resampling.NEAREST)
        x = index * CELL_SIZE[0] + (CELL_SIZE[0] - fitted.width) // 2
        y = BASELINE - fitted.height
        atlas.alpha_composite(fitted, (x, y))

    if atlas.size != ATLAS_SIZE or atlas.mode != "RGBA":
        raise ValueError("Reconstructed atlas did not meet the required RGBA dimensions")
    for index in range(4):
        cell = atlas.crop((index * 128, 0, (index + 1) * 128, 128))
        if cell.getchannel("A").getbbox() is None:
            raise ValueError(f"Reconstructed pose {index + 1} is empty")

    destination.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(destination, format="PNG", optimize=True)
    return bounds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    bounds = reconstruct(args.source, args.destination)
    print(f"Wrote {args.destination}: 512x128 RGBA; alpha bounds={bounds}")


if __name__ == "__main__":
    main()
