# Piezas del lanzador arcade

Generadas con la herramienta integrada image_gen para TikReader. Archivos: sack.png (saco), gear.png (engranaje), needle.png (aguja).

Las imágenes usan un fondo verde uniforme de composición; gift_cannon.js lo convierte en transparencia al cargar y conserva los contornos oscuros. No se usa el patrón cuadriculado de los primeros borradores. Las rosas se cargan del catálogo de TikTok, no están dibujadas dentro de estos archivos.

## Prompts de generación

### sack

Use case: stylized-concept. Create one production-ready isolated 2D game sprite: a plump open tan burlap gift sack, friendly 1990s bubble-shooter arcade illustration with bold dark brown outlines and warm golden cel shading, a wide open oval mouth at the top visibly empty and dark inside, folded cloth rim, tied short rope around neck but mouth open, rounded weighted base. Front view with slight view down into opening, centered upright, occupies 85% of square canvas. No roses inside (they will be animated separately), no lettering, no character, no gear, no arrow, no environment, no ground plane or cast shadow. Genuine transparent alpha background, no checkerboard pattern. Crisp readable silhouette at 120px.

### gear

Use case: stylized-concept. Create one production-ready isolated 2D game sprite: a round golden brass arcade aiming gear, exactly circular and front-facing, 12 broad teeth, amber cel shading and dark brown outline, concentric beveled rings, small ruby-red circular hub precisely at canvas center. Cheerful 1990s bubble-shooter arcade illustration, clean bold illustrated game art, not photorealistic. Gear centered occupies 85% of square canvas. No arrow or needle, no sack, no lettering, no environment or shadow. Genuine transparent alpha background, no checkerboard pattern.

### needle

Use case: stylized-concept. Create one production-ready isolated 2D game sprite: a slender golden arcade aiming arrow / compass needle pointing straight UP vertically. Sharp long triangular gold tip, narrow golden shaft with ruby red inset stripe, small round brass pivot at bottom. Cheerful 1990s bubble-shooter arcade illustration, dark brown outline and warm gold cel shading. Exact geometry for animation: arrow tip at x50% y8%, round pivot CENTER at x50% y85%; all of arrow above pivot, symmetrical about vertical center. Full sprite on square canvas, narrow silhouette centered. No dial, no gear wheel, no sack, no lettering, no environment or cast shadow. Genuine transparent alpha background, no checkerboard pattern.

## Edición final común

Preserve the illustrated object exactly, same position, dimensions, colors and silhouette. Replace only the checkerboard background with uniform solid chroma-key green RGB(0,255,0), #00ff00. No checkerboard, gradients, shadow outside object or green on the object itself. Preserve all dark outlines.
