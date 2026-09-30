# Validación física antes de producción

Esta ronda requiere al operador y no puede certificarse mediante simulaciones.
No compres regalos exclusivamente para probar; usa eventos reales si ocurren.

## Cobertura automatizada actual

El 28 de septiembre de 2026 se validaron 343 casos Python y 145 casos de
navegador, incluidos conexión y reconexión, límites de colas, regalos por racha,
pausa de emergencia, cambio de voz durante síntesis, recuperación de historial,
permisos locales, rotación de registros y la ruta Básica. También se comprobó el
paquete autónomo arrancando dos veces con su Python incluido y sin el Python del
sistema, con Vosk local, persistencia de preferencias y cierre limpio.

Esta evidencia reduce el riesgo del software, pero no marca ninguno de los puntos
físicos siguientes: audio, programa de streaming, GPU, red y eventos reales deben
probarse en el equipo que transmitirá.

## Preparación

La ronda local del 12 de septiembre está documentada en [Correcciones de estabilidad](../archivado/documentos/CORRECCIONES_ESTABILIDAD_2026-09-12.md). Incluye generación real de voces y una medición prolongada iniciada, pero no sustituye esta lista física.

- Ejecuta `python app/launcher.py --check` y corrige los elementos marcados.
- Ejecuta `python tools/check_changes.py` y confirma que termina sin errores.
- Abre TikReader, tu programa de streaming y el live de prueba.

## Lista de aceptación

- [ ] La voz se escucha en la salida de audio elegida y respeta volumen/pausa.
- [ ] Mantener pulsado el micrófono pausa la lectura y al soltarlo continúa.
- [ ] Comentarios, likes, espectadores y un regalo real coinciden razonablemente con TikTok.
- [ ] Las fuentes de navegador del programa de streaming cargan y se ocultan durante emergencia.
- [ ] Un teléfono en la LAN no puede abrir controles completos.
- [ ] La clave temporal del moderador funciona, caduca y puede revocarse.
- [ ] Tras desconectar y recuperar Internet, el live reconecta sin duplicar comentarios.
- [ ] `python tools/soak_test.py --seconds 14400 --pid PID` termina sin errores ni crecimiento anormal de memoria.

Guarda fecha, versión, dispositivos y resultado. No incluyas nombres ni comentarios reales en el reporte.
