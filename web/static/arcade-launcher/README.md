# Arcade launcher artwork

Active assets:
- cannon-v3.png: stationary gold cradle and steel muzzle, with the embedded fixed spear removed using built-in imagegen.
- sack-v2.png: unchanged open burlap gift sack.
- aim-arrow-v3.svg: one independently rotating decorated brass/ivory aiming spear, with faceted broad tip, gold collars, engraved shaft and a small hub medallion. Authored as vector artwork for clean rotation and exact pivot placement.

The assembly is 330 by 210 CSS pixels. The cannon is 210 by 210 at (120,0), the sack is 132 by 148 at (0,62). The aiming arrow is 40 by 110 at (205,0), with bottom-center pivot at (225,110), matching the loaded gift and launch origin. Only this arrow rotates. No pseudo-element or dotted secondary arrow remains. Older assets are retained but are not loaded.

## Final image-generation prompt
Built-in imagegen precise-object-edit; edit target cannon-v2.png, genuine transparent background:

Edit target: attached transparent arcade cannon sprite. Precise-object-edit: remove ONLY the entire vertical spear/arrow above the central steel globe, including pointed gold tip, cream shaft and its gold mount that projects above globe. Make that upper central area genuinely transparent. Preserve exactly the original gold horseshoe cradle, ornate plinth, central steel globe/muzzle, colors, dimensions and positioning in same square canvas. No redesign, no new objects, no arrow anywhere. Retain genuine alpha transparency. The final sprite is the exact same complete stationary mechanism with an empty clear space above its round steel muzzle, so a separate rotating pointer can be layered there.

Saved project asset: web/static/arcade-launcher/cannon-v3.png. The generated PNG retains alpha ranging from 0 to 255. The existing sack-v2.png is unchanged; its original prompt was: A single large recognizable OPEN TAN BURLAP GIFT SACK, front three-quarter view, broad pear-shaped fabric bag resting on floor, gathered folded rim with a wide dark OPEN mouth clearly visible at top, rope tie dangling to right, thick chunky cloth folds, golden beige highlights and rich brown shadows. Match polished detailed 1990s 16-bit arcade pixel art, clustered crisp pixels, strong dark outline, high-quality readable silhouette even at 100 pixels. Bag fills 90% square canvas. True transparent background. Empty bag with visible opening. No characters, dinosaurs, logos, text, coins, cannon, separate objects, scene, glow or shadow outside sprite.

## Verification
Static composition inspected at -52, 0 and +52 degrees, using the same CSS dimensions and pivot. Each state shows exactly one aiming spear over the arrow-free cannon, with the sack visible. This is layout/artwork QA, not a browser screenshot. Composite: C:/Users/Carlos/.codex/visualizations/2026/10/22/01a16181-63c5-7171-b4f8-16a9234193a3/single-arrow-angles.png.
