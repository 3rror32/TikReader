# Correcciones y validación local — 12 de septiembre de 2026

## Cambios

- Cañón de regalos: reproducido el bloqueo con semilla 21 en la segunda donación. El contacto con la pila podía mantener movimiento residual e impedir que avanzara la cola. Los regalos apoyados se duermen después de medio segundo de movimiento insignificante; se corrigió también el rebote en fotogramas lentos y se limita la posición tras resolver contactos. No se introduce un tiempo máximo arbitrario de vuelo.
- Al detener el cañón se vacía también su colección de regalos retenidos.
- Las pruebas del cañón usan trayectorias reproducibles, verifican terminación antes de esperar promesas y cubren 240 donaciones con fotogramas de 16 y 40 ms, además de detener y volver a iniciar.
- El diagnóstico de arranque rechaza respuestas JSON que no sean objetos, sin provocar una excepción al encontrar otro servicio.
- El muestreo de estabilidad respeta TIKREADER_PORT, evalúa crecimiento de memoria después del calentamiento y declara datos insuficientes cuando no puede comprobarla. El umbral predeterminado de 100 MB es configurable y no equivale a una prueba de ausencia de fugas.
- Se añadieron pruebas de arranque, diagnóstico, memoria, protocolo del motor de voz y deduplicación después de una reconexión.
- Se corrigió la configuración de cuatro pruebas de voz para reflejar la casilla «Leer el nombre» activada en el HTML. Se comprueba también la opción desactivada.
- La batería JavaScript tiene un límite de 30 segundos por prueba para evitar esperas indefinidas.

## Verificado

- 285 pruebas Python aprobadas.
- Batería JavaScript final: 119 pruebas aprobadas, sin fallos, cancelaciones ni omisiones. Total: 404 pruebas Python y JavaScript.
- Sintaxis JavaScript y Ruff sin incidencias en la batería completa.
- Las 41 voces Kokoro instaladas generaron WAV válidos, con muestras no nulas. Esto no certifica pronunciación, volumen audible ni captura por streaming.
- RVC generó 2,6 segundos de audio y confirmó CUDA en NVIDIA GeForce RTX 4070 Ti.
- El panel abrió en un navegador y mostró TikTok desconectado.

## Prueba prolongada en curso

Se inició una medición de 14.400 segundos sobre el proceso 23532. El informe se actualiza en `data/diagnostics/estabilidad-2026-09-12.json`. Solo puede darse por completada cuando indique `status: finished`; `passed` y `errors` contienen el resultado. Se observa el servidor activo en reposo, sin una transmisión conectada, y no se mide la memoria del navegador ni de los procesos de voz separados.

El proceso debe permanecer abierto durante la medición. Reiniciarlo invalida la continuidad. Esta ronda no requiere reiniciar el servidor: el cambio Python está en el lanzador y el resto son herramientas, pruebas y JavaScript. Para cargar el cañón corregido, recarga el panel o la fuente de navegador que ya estuviera abierta.

## Pendiente de comprobación física

Continúan pendientes voz audible, micrófono, captura de audio y overlays en el programa de streaming, eventos reales de TikTok, acceso desde teléfono y recuperación después de un corte físico de Internet. Se necesita una transmisión y los dispositivos del operador; no se marcan como aprobados por simulación.

## Evidencia

- `runtime/correcciones-2026-09-12-tests.log`
- `runtime/correcciones-2026-09-12-node-final.log`
- `data/diagnostics/local-voices-validation.json`
- `data/diagnostics/rvc-validation-2026-09-12.json`
- `data/diagnostics/estabilidad-2026-09-12.json`

Para repetir la generación de las 41 voces sin reproducir audio: `python tools/validate_local_voices.py`.
