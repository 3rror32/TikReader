# Amigos de la transmisión

Ocho colecciones de diez personajes distintos: dragones, dinosaurios, robots,
mascotas, goblins, elfos, monstruos y personas chibi. Todo en pixel art.

Los recursos activos están en `walk-v3/`: 80 tiras PNG RGBA de 3072 × 128 px,
con 24 poses y una imagen independiente de reposo por personaje. Los ciclos se
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
`tools/qa_buddies.cjs`. Se verificaron transparencia RGBA, 1,920 fotogramas
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
