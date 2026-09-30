# Revisión funcional del 4 de septiembre de 2026

Resultado: las comprobaciones automáticas pasan y el servidor está operativo. No se puede certificar que todas las funciones trabajen correctamente de extremo a extremo: hay un error de navegador reproducible y varias comprobaciones necesitan servicios o dispositivos reales.

## Verificado correctamente

- `python app/launcher.py --check`: aprobado; servidor activo, dependencias disponibles y acceso local.
- `python tools/check_changes.py`: código de salida 0. 185 pruebas Python y 67 JavaScript aprobadas (252 pruebas distintas). El ejecutor repite las 185 Python al medir cobertura; no se cuentan dos veces.
- Sintaxis de los JavaScript de `static` y Ruff: aprobados.
- Cobertura Python: 69%, por encima del mínimo configurado de 55%. No equivale a cobertura total de funcionalidades.
- La batería cubre recepción simulada, deduplicación, reconexión, likes, regalos y rachas, participantes e insignias, filtros y colas de voz, moderación, preguntas, permisos, historial y recuperación, idiomas, controles de producción, overlays, animaciones, encuestas, puntos, juegos, Minecraft, Spotify y controles RVC. Las integraciones se prueban en gran parte con sustitutos simulados.
- Carga aislada incluida en la batería: comentarios, likes duplicados, 2.000 rachas de regalos y persistencia de 1.000 comentarios.
- Navegación real del panel básico: En vivo, Voz y traducción, Spotify, Preguntas, Panel de moderador, Encuesta del chat, Historial y Ajustes y perfiles. Las vistas cargan; el historial enumera sesiones guardadas. Esto no implica que cada botón se haya ejecutado contra datos reales.
- Base de datos: disponible, integridad `ok`, esquema 2, 55 sesiones.
- Muestreo HTTP de 60 segundos: 13 muestras, cero errores; latencia de `/feed` entre 1,32 y 15,82 ms, promedio 7,30 ms. Servidor sin conexión TikTok durante la observación. No fue una prueba prolongada ni con carga real.
- RVC real: conversión mediante `/voice-models/render` confirmada en CUDA con NVIDIA GeForce RTX 4070 Ti. WAV válido de 3,04 segundos, 32.000 Hz y 194.604 bytes. No se reprodujo el sonido.

## Hallazgos y limitaciones

1. **Error JavaScript reproducible al cargar y recargar.** La consola registra `Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.` Apareció en dos cargas. El registro disponible no aporta archivo ni línea; no quedó confirmado su origen ni qué función afecta. La navegación observada siguió funcionando. Las pruebas automáticas no detectaron este error.
2. **Demora de voz RVC.** La conversión real tardó 12,01 segundos para 3,04 segundos de audio, con `keep_warm=false` y el modelo sin precargar. Es una sola medición; no demuestra la latencia con el modelo precargado. Puede afectar la fluidez del chat y requiere medir varias lecturas consecutivas.
3. **TikTok desconectado.** Sin conexión en curso, sin último error y sin reintentos activos. No hubo validación nueva de comentarios, regalos, likes o espectadores reales. Desconectado no equivale a averiado.
4. **Spotify desconectado.** La interfaz y las pruebas simuladas pasan; falta validar autenticación, dispositivo y reproducción reales.
5. **Audio y servicios externos pendientes.** No se verificaron sonido audible, captura de micrófono, traducción real en este navegador, fuentes dentro del programa de streaming, moderación desde otro dispositivo, comandos reales en juegos/Minecraft/Streamer.bot, cortes físicos de Internet ni estabilidad de cuatro horas.

No se modificó el código del producto durante esta revisión. Se generaron registros, medición de cobertura y un audio de prueba local.

## Evidencia

- `tmp/revision-completa-tests.log`
- `tmp/revision-estabilidad.json`
- `tmp/revision-voz.json`
- `tmp/revision-voz.wav`
