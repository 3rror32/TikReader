# Caballero: prueba individual

Solo `chibis-0` se sustituye. La versión anterior de `walk-v2/chibis-0.png`
se renombró a `walk-v2/chibis-0-bkc.png`. También se conservó una copia de la
versión activa en `walk-v3/chibis-0-bkc.png`.

Nueva hoja: ImageGen integrado, usando `walk-v3/chibis-0-idle.png` como
referencia de identidad. Prompt completo y origen en `source.json`; salida
original en `source-atlas.png`. Doce poses dibujadas, incluyendo cambios en
las piernas, la capa y el penacho. Python se usó únicamente para eliminar
el fondo cian y extraer las celdas con una escala común, sin deformar miembros.

`chibis-0.png`: 1536 × 128, 12 celdas de 128 × 128 con alfa real.
`frame-01.png` a `frame-12.png`: poses separadas.
`index.html`: prueba aislada con pausa, avance de poses y control de ritmo.
`walk.gif`: muestra ampliada en bucle sobre fondo oscuro de revisión.

La tira se copió a `walk-v2/` y `walk-v3/`. La metadata activa reconoce
12 poses solo para este personaje; los demás mantienen sus archivos.
`authored-overrides.json` evita reemplazarlo al regenerar los ciclos anteriores.
Las verificaciones de geometría de los ciclos sintéticos no validan esta
secuencia dibujada: debe evaluarse visualmente en su vista aislada.
