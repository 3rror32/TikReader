# Anime classics sprite provenance

## Repository sprites

Goku, Luffy, Sailor Moon, and Totoro were sourced from the public
[vikas0304/vscode-anime repository](https://github.com/vikas0304/vscode-anime),
from its media assets on the `main` branch. The repository declares an MIT
license in its [LICENSE file](https://github.com/vikas0304/vscode-anime/blob/main/LICENSE).
No separate rights statement for these individual character assets was found.

The supplied sheets were 1024×1024 PNGs with checkerboards baked into the
pixels. Goku was a 2×2 sheet; the other three were four-frame horizontal
sheets. Background pixels were keyed from the sheet edges, each figure was
trimmed and aligned to a shared frame cell, and the first walking pose was
used for the idle image. Totoro's gray fill overlaps the checkerboard tones,
so its edge key was narrowed to near-neutral pixels with average intensity
above 150 to preserve the darker body pixels. The repository attachment
transfer did not preserve the original media filenames.

| Character | Project assets | Frames |
| --- | --- | ---: |
| Goku | `anime-goku.png`, `anime-goku-idle.png` | 4 |
| Luffy | `anime-luffy.png`, `anime-luffy-idle.png` | 4 |
| Sailor Moon | `anime-sailor-moon.png`, `anime-sailor-moon-idle.png` | 4 |
| Totoro | `anime-totoro.png`, `anime-totoro-idle.png` | 4 |

## Original generated sprites

Doraemon and Seiya were created for this project with the built-in ImageGen
tool using transparent-background prompts. The walking sheets contain six
frames in the top row and an idle pose below; the matching project idle PNG
was cropped from that pose.

- **Doraemon-inspired robot cat:** original blue cartoon cat robot with a red
  collar and golden bell, in a six-frame side-view walk cycle; generated from
  a transparent pixel-art sprite-sheet prompt.
- **Seiya-inspired bronze hero:** original chibi young hero with bronze armor,
  dark blue hair and a red headband, in a six-frame side-view walk cycle;
  generated from a transparent pixel-art sprite-sheet prompt.

The original generated sheets are retained outside the project at
`C:\Users\Carlos\.codex\generated_images\01a1ec85-7847-7bb0-977e-5c269a04b039\exec-e0a4be3d-40e9-4e66-8d8e-daa12f77aa49.png` (Doraemon-inspired) and
`C:\Users\Carlos\.codex\generated_images\01a1ec85-7847-7bb0-977e-5c269a04b039\exec-a8ba847b-793d-4a29-a1a0-a92e0b20aeb3.png` (Seiya-inspired).

## Additional generated characters

Naruto, Ichigo Kurosaki, Inuyasha, Astro Boy, and Tanjiro were generated as
original transparent pixel-art/chibi sheets with the built-in ImageGen tool.
Each sheet has six side-view walking frames; the idle image reuses its first
walk frame. Distinctive cues used were blond hair, forehead protector and
orange outfit (Naruto); orange hair, black robe and sheathed sword (Ichigo);
silver hair, dog ears and red robe (Inuyasha); black two-point hair, green top,
blue shorts and red boots (Astro Boy); burgundy hair, forehead scar, earrings
and green-checkered haori (Tanjiro).

| Character | Project assets | Frames | Generated source |
| --- | --- | ---: | --- |
| Naruto | `anime-naruto.png`, `anime-naruto-idle.png` | 6 | `exec-c00f11fe-2498-42b2-b9f6-65fdf7918132.png` |
| Ichigo Kurosaki | `anime-ichigo.png`, `anime-ichigo-idle.png` | 6 | `exec-7cf7fa04-434d-4157-aba3-33cd0e80cf7a.png` |
| Inuyasha | `anime-inuyasha.png`, `anime-inuyasha-idle.png` | 6 | `exec-bddd24e8-f135-4c8f-b9cd-fec8c2995815.png` |
| Astro Boy | `anime-astro-boy.png`, `anime-astro-boy-idle.png` | 6 | `exec-75610967-cee7-442a-b09f-7b7b80ebaf7c.png` |
| Tanjiro | `anime-tanjiro.png`, `anime-tanjiro-idle.png` | 6 | `exec-44d1b347-9599-46b0-9116-7426474485b2.png` |

The source PNGs are retained in
`C:\Users\Carlos\.codex\generated_images\01a1ec85-7847-7bb0-977e-5c269a04b039`.
The first combined generation attempt was rejected; four completed sheets were
recovered, and Astro Boy succeeded after a simplified prompt retry.

## ANIME-3 refined sheets

The five assets were refined from the parent-provided ImageGen candidates
below. The originals remain in
`C:\Users\Carlos\.codex\generated_images\01a1e0e2-ba2c-75d0-a405-cb9a8ce8015d`.
Ichigo and Inuyasha use the supplied background-extraction rerenders; the other
three use the supplied transparent sheets. Each source contains six frames in
one horizontal row. The output strips use those six cells, and each idle PNG
reuses the first frame. All five source sheets already had transparent
backgrounds.

| Character | Refined source sheet |
| --- | --- |
| Naruto | `exec-8c566af0-67b1-4c4b-a9bb-21f07217f7bd.png` |
| Ichigo Kurosaki | `exec-d0225ae1-fe69-4b03-b80a-d7b47bf10130.png` |
| Inuyasha | `exec-1f86d008-9bf0-4e1a-8563-338f18587d57.png` |
| Astro Boy | `exec-905348f8-5bf9-4cac-8187-1917f7b29d5b.png` |
| Tanjiro | `exec-4f3a5c51-8e5a-4825-88d9-420d90e8342e.png` |
