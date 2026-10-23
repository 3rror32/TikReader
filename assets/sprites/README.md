# Amigos de la transmisión

Ocho colecciones de diez personajes distintos: dragones, dinosaurios, robots,
mascotas, goblins, elfos, monstruos y personas chibi. Todo en pixel art.

Los recursos activos están en `walk-v3/`: 79 tiras PNG RGBA de 3072 × 128 px
con 24 poses, más el caballero `chibis-0` de 1536 × 128 px con 12 poses
dibujadas. Son 1,908 fotogramas y una imagen de reposo por personaje. Los ciclos se
preparan con `tools/anatomical_buddies.py`: cadera, rodilla, tobillo y pie
articulados, textura por segmentos, apoyo fijo y elevación durante el avance.

La anatomía es individual: 26 cuadrúpedos y 54 bípedos (incluidos cinco con
ropa larga y la gelatina). Los dinosaurios 0, 4, 6, 7, 8 y 9 son bípedos;
los dinosaurios 1, 2, 3 y 5 son cuadrúpedos. Los robots 6 y 9 tienen cuatro
patas según el dibujo. No se aplica una anatomía única a toda una colección.

Los cuadrúpedos usan cuatro fases escalonadas con tres apoyos mínimos; los
bípedos usan alternancia y doble apoyo. El ritmo depende de la distancia,
el tamaño y la longitud de paso, con límite de 1.8 ciclos/s para conservar
una caminata cuando se pide una velocidad muy alta. A velocidad cero se usa
la pose de reposo. Los fotogramas anteriores se conservan como fuentes.

`walk-v3/review.html` permite revisar los 80 ciclos, cambiar velocidad, detener
el desplazamiento, avanzar poses y visualizar los apoyos. Es una herramienta
con datos de ejemplo, independiente de los donadores y del fondo del LIVE.

Las mascotas recibieron nuevas poses base de cuatro patas, conservando
especies y accesorios: ImageGen con fondo cian, eliminado con Python según
la autorización del usuario. Hoja en `walk-v3/base/pet-atlas.png` y prompt en
`walk-v3/pet-source.json`. No se usa el fondo cian en el overlay.

Generación: herramienta integrada ImageGen. Prompts y hojas originales en
`atlas-manifest.json` y `source-atlases/`. El generador dibujó fondos de cuadros;
el usuario autorizó explícitamente limpiarlos y preparar los fotogramas con
Python. `tools/prepare_buddies.py` extrae el fondo conectado, conserva los
contornos y alinea los pies. Las tiras finales tienen canal alfa real y bordes
transparentes. `walk-preview.png` muestra el catálogo sobre fondo oscuro solo
para inspección; ese fondo no se incorpora al LIVE.

## Comportamiento

- Cada colección usa una bolsa aleatoria de diez personajes, sin repetición
  hasta agotarla; entonces comienza otra bolsa.
- Las asignaciones se guardan en el servidor durante la sesión. Cambiar el
  ranking, ocultar un donador o recargar OBS no cambia su personaje. Al cambiar
  de colección se asigna un personaje de esa colección; al volver se recupera
  la asignación anterior. Una nueva sesión inicia nuevas asignaciones.
- El valor acumulado en monedas determina diez niveles de crecimiento.
  Nivel = min(10, max(1, 1 + floor(9 × monedas / umbral))). Umbral inicial: 1,000.
  Donaciones posteriores al umbral no aumentan el tamaño. No se compara con
  el total del líder, de modo que otro donador no hace encoger un personaje.
- Tamaños iniciales: 56–112 px, ajustables hasta 160 px. Todo el rango se reduce
  proporcionalmente si supera 24% del ancho o 22% del alto de la fuente.
- El fondo del widget siempre es transparente. La vista previa usa un fondo
  oscuro liso para distinguir los personajes, sin cuadrícula.
- La vista privada tiene datos ficticios; guardar publica la configuración.

Validación: `tests/test_stream_buddies.py`, `tests/test_stream_buddies.cjs` y
`tools/qa_buddies.cjs`. Se verificaron transparencia RGBA, 1,908 fotogramas
distintos, asignación sin repeticiones prematuras, estabilidad de sesión,
límite de crecimiento y visualización en 390 × 844 y 1280 × 720.


## Revisión de la versión 3

Se realizaron varias pasadas: clasificación por anatomía; articulación de
patas y reconstrucción de las bases de mascotas; corrección del vientre y
las patas de robots; alineación al suelo después de limpiar píxeles sueltos.
Se inspeccionaron las ocho hojas de poses y las vistas de navegador.

`tools/verify_buddies_walk.py` comprueba todos los sprites: transparencia,
márgenes, apoyo continuo, invariancia de longitud de huesos, posición del pie
plantado, proximidad de los píxeles al suelo y continuidad del cierre del ciclo.
`tools/qa_all_buddies.cjs` reproduce los 80 en el servidor local y prueba
velocidades 0, 10, 40 y 100 en el overlay. Estos controles verifican geometría
y reproducción; la naturalidad visual sigue siendo un criterio artístico.

## Walking mechanics and regeneration

Bipeds follow contact → down → passing → up, repeated on the other leg.
Image Y increases downward: the pelvis sinks after contact and reaches its
highest position before the next contact. Both feet travel through a shared
pelvis center, rather than shuffling around the separated foot positions of
the source drawing. Knees articulate while swing feet lift clear of the ground.

Quadrupeds use a lateral four-beat walk: far hind → far fore → near hind →
near fore. Each leg supports the body for 75% of the cycle; three paws remain
planted while one swings. Near/far layers share the ground line and use color
depth to distinguish the limbs. The rabbit uses this deliberate slow walk
rather than a hop. Dinosaur gait classification follows each drawing; the
four-legged robots use the same mechanically stable support order.

Playback remains distance driven: planted feet move backward by exactly the
character's forward displacement. Per-character metadata controls strip width,
frame count and stride, including the preserved twelve-frame knight override.
PNG publication is atomic so local previews never read a half-written strip.

References: [biped poses](https://www.hyperpad.com/documentation/art-studio-tutorial-create-a-walk-animation),
[canine walk](https://vanat.ahc.umn.edu/gaits/walk.html),
[lateral footfalls](https://horses.extension.org/horse-walk/).

Run `python -m pytest tests/test_buddies_gait.py -q`, then
`python tools/anatomical_buddies.py` and `python tools/verify_buddies_walk.py`.
The generator skips `authored-overrides.json` entries without modifying their
PNG files. `node tools/qa_all_buddies.cjs` needs the local preview on port 5000;
it checks all eighty characters, all collections at four overlay speeds, and
complete representative cycles at slow/normal speed in both directions.

## Fire-dragon prototype

`fantasia-0` has an explicit rig in `walk-v3/dragon-rigs.json`. Four separately
masked source legs replace the two generic duplicated cutouts. Fore limbs use
shoulder, elbow, wrist and paw; hind limbs use hip, stifle, hock and paw.
The body makes a small coherent weight transfer while support paws remain planted.
No new limb artwork was painted. This prototype passed independent review;
its PNG and rig remain unchanged while the other nine receive individual rigs.

Regenerate only the prototype with `python tools/anatomical_buddies.py --character fantasia-0`.
After all dragon rigs are reviewed, `--theme fantasia` restricts generation to
dragons while preserving every other collection and its metadata. The prototype
preview remains `walk-v3/dragon-prototype.html`. All ten are selectable in
`walk-v3/dragon-walk-review.html`, with a full-grid view and optional joint overlay.
`node tools/qa_dragon_buddies.cjs` records all ten visibly at twice source
resolution, slow/normal speeds and both directions, and captures each full cycle.
`node tools/qa_all_buddies.cjs --no-screenshots` checks all eighty sprites and
runtime metadata without replacing other collections' review images.

Each dragon has its own source masks, shoulder/hip positions and rest paws.
The rock dragon uses shorter steps, lower lift and reduced body pitch; the
green dragon's short far forelimb has its own lower swing lift. Other variants
fit their body height to their limb lengths and align paws to the ground.
An explicitly masked white background hole is removed from the purple dragon's
generated output; the input artwork is preserved. Numeric checks do not establish
visual approval, and partially occluded far limbs keep their original visibility.

## Animal prototypes

`walk-v3/animal-rigs.json` fits four source-pose rigs: the biped T. rex and
upright raccoon, plus the quadruped Triceratops and cat. Held forepaws remain
hands on upright pets. Each animated limb uses a distinct original texture,
an individual hip/shoulder root, knee/elbow, ankle and paw. Foot masks include
the original one-pixel outlines so stationary source toes cannot remain behind.
The Triceratops has one narrowly scoped neutral background-hole exclusion;
white fur, teeth and claws are preserved. The original atlases remain unchanged.

`python tools/anatomical_buddies.py --character dinosaurios-0 --character
dinosaurios-1 --character mascotas-0 --character mascotas-4` regenerates only
the four prototypes. `walk-v3/animal-walk-review.html` and
`node tools/qa_animal_buddies.cjs` show all four at twice source resolution,
with actual travel, slow/normal speeds and both directions. The recording uses
the production distance/stride calculation and 1.8-cycle-per-second cap.
Chronological sheets and `animal-prototype-validation.json` accompany the movie.
The remaining sixteen animals require individual fitting and visual acceptance;
these prototype checks do not establish their source-limb recoverability.

All twenty dinosaurs and pets now have individual explicit rigs. Dinosaurs
0/4/6/7/8/9 and pets 3/4/7/8 are bipeds; the others are quadrupeds. Selected
alternate original poses recover occluded far forelimbs for the stegosaur,
long-neck dinosaur, corgi and rabbit. The clean long-neck base uses pose 3.
Source forepaws remain held hands on the four upright pets.

The hedgehog keeps its original body and three drawn limb regions. Its fourth,
far-hind limb is new generated artwork in
`animal-art/mascotas-6-far-hind-v1.png`; the matching prompt sidecar records its
provenance. The raw 1254-square transparent image remains unchanged. Native
nearest-neighbor import fits a 128-square logical cell, with a narrow component
mask excluding faint stray alpha and a two-pixel upward placement adjustment.

The animal review and QA now show all twenty at twice source resolution in a
1280-by-3060 canvas. `animal-walk-playback.webm`, twenty chronological sheets
and `animal-walk-validation.json` cover slow/normal speed in both directions.
The committed `animal-prototype-*` proof remains unchanged. Regenerate the
sixteen additions with repeated `--character` selectors to retain those four
accepted prototypes and all other collections byte-for-byte.

## Character morphology gate

`walk-v3/character-rigs.json` fits nine original-pose prototypes: chibis-1/2,
goblins-4, elfos-1, cyborgs-1/2/6/9 and monstruos-0. The separate character
renderer preserves actual boot/pad pixels with rigid translations while the
source-textured chain above each fitted collar bends. Robes keep their complete
decorated hems over concealed chains; the two original boots step behind them.
Every mask is individually fitted, including the original calf/toe outlines.
No new artwork, cloned limbs or blanket bright-pixel cleanup is used.

Cyborgs-6 uses four distinct radial source chains. Cyborgs-9 has three actual
support pads and serial touchdown frames 0/8/16, stance .75 and at least two
planted supports. The restrained three-beat transfer is a stylized gait, not a
physical balancing certification. The authored chibis-0 remains unchanged.

Repeat `--character` for the nine keys with `tools/anatomical_buddies.py`;
selected generation preserves the other 71 metadata/trace entries.
`walk-v3/character-walk-review.html` shows all nine plus the twelve-frame knight
control at twice source size, actual translation, both directions and speeds
4/18. `node tools/qa_character_buddies.cjs` records all forty complete cases,
per-character chronological sheets and a WebM using production stride/cap
behavior. Variable-rate recordings require sequential timestamp decoding; a
decoder's nominal FPS is not measured capture throughput.
The other forty mutable characters require their later rollout gate.
