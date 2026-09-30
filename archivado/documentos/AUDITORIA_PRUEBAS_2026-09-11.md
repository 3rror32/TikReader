# Auditoría de pruebas de TikReaer

Fecha: 11 de septiembre de 2026. Entorno: Windows, Python 3.14.7, Node.js 24.19.0.

## Resultado

Se ejecutaron todos los archivos de pruebas propios del proyecto: 276 pruebas Python y 116 pruebas JavaScript. La ejecución completa final pasó las 392 pruebas, sin omisiones. Sin embargo, una repetición dirigida confirmó una prueba intermitente en el cañón de regalos. No se puede certificar que todo funciona en producción.

No se modificó el código de la aplicación ni sus pruebas. Se generaron registros y este informe.

| Comprobación | Resultado |
|---|---|
| Python: descubrimiento completo con unittest y cobertura | 276 aprobadas; 15,868 segundos |
| JavaScript: los 21 archivos test_*.cjs | 116 aprobadas en la ejecución completa con límite de 30 segundos por prueba |
| Repetición del cañón de regalos | 19 ejecuciones aprobadas; 1 con cancelación por tiempo agotado, de 20 |
| Sintaxis JavaScript | 72 archivos revisados, sin errores |
| Ruff: análisis estático | Sin incidencias |
| Diagnóstico de arranque | Dependencias disponibles, configuración local correcta y servidor activo saludable en el puerto 5000 |
| Muestreo HTTP del servidor activo | 60,04 segundos, 13 muestras, 0 errores; latencia máxima observada del feed: 24,65 ms |
| Cobertura Python, líneas y ramas combinadas | 74,84 %; supera el mínimo configurado del 55 % |

La cobertura de líneas es del 79,50 % y la de ramas del 62,50 %. Quedan 1.143 líneas ejecutables y 789 ramas sin recorrer. La cobertura no mide la utilidad del producto ni sustituye la comprobación visual o física.

## Qué está correcto y probado

Los siguientes resultados corresponden a los escenarios automatizados existentes, algunos con servicios y dispositivos simulados:

| Funcionalidad | Verificación aprobada |
|---|---|
| Comentarios y participantes | Ciclo de conexión simulado, deduplicación, actividad, navegación, insignias y datos de usuario |
| Likes, regalos y clasificaciones | Conteos, rachas, rankings de likes y donadores; eventos simulados |
| Historial y almacenamiento | Consultas, persistencia, copias, restauración, retención y validación de datos |
| Seguridad y privacidad | Rechazo de operaciones remotas o entre orígenes, controles privados y ocultación de información |
| Producción y moderación | Emergencia, escenas, preguntas preparadas, perfiles y herramientas del operador |
| Overlays y widgets | Configuración, galería, transiciones, metas, temporizadores, emojis y animaciones; con la incidencia del cañón indicada abajo |
| Interactividad | Juegos, puntos, ruleta, caída de regalos, atajos y personajes del chat en escenarios simulados |
| Voces | Selección, pausas, emergencia, cancelación de lecturas antiguas, liberación de modelos y validación de solicitudes |
| Idiomas | Español, inglés y francés, persistencia de selección, textos dinámicos y conservación del contenido de usuarios |
| Herramientas del creador | Escenas, analítica, batallas y controles contemplados por la batería existente |
| Spotify, Minecraft, OBS y chatbot | Lógica y contratos cubiertos por las pruebas; no certifican conexión real con esos servicios |

## Qué falla o no es fiable

**Incidencia confirmada en las pruebas del cañón de regalos.** La primera ejecución global no concluyó y su salida quedó después de las primeras cuatro pruebas del cañón. Se interrumpió y se volvió a ejecutar con límites de tiempo. Esa ejecución completa sí pasó.

Para investigar la irregularidad se ejecutó el archivo del cañón 20 veces adicionales. La quinta repetición agotó el límite de 2 segundos en `ten roses remain after completion and a second donation adds another ten`, situado en `tests/test_gift_cannon.cjs:41`. Las otras 19 repeticiones pasaron.

El caso espera la finalización de animaciones después de avanzar un número fijo de fotogramas; la implementación usa valores aleatorios para la física. La evidencia confirma una prueba intermitente con espera sin resolver. Falta determinar si la causa está en el escenario de prueba, en la lógica de asentamiento de las rosas o en ambos. No se certifica como fiable el escenario de acumular dos donaciones consecutivas. Tampoco se afirma que el fallo se haya reproducido visualmente en una transmisión real.

Evidencia: `runtime/auditoria-cannon-05.log` y `runtime/auditoria-cannon-resumen.json`.

## Qué no se ha podido certificar

- Recepción real de comentarios, likes y regalos de TikTok: el servidor estuvo desconectado durante el muestreo.
- Voz audible, volumen efectivo, micrófono, salida de audio y captura del sonido por el programa de streaming.
- Conversión real RVC con GPU y síntesis real de todas las voces.
- Conexión real y operaciones de Spotify, Minecraft, OBS y servicios externos del chatbot.
- Apariencia y comodidad de uso en un navegador real: las pruebas JavaScript usan entornos simulados, no una revisión visual completa.
- Acceso desde un teléfono y reconexión tras perder físicamente Internet.
- Estabilidad durante cuatro horas y evolución de memoria: el muestreo realizado duró un minuto y no incluyó medición de memoria del proceso.

Estas limitaciones significan **pendiente de verificar**, no “no funciona”. La lista de aceptación física está en `docs/VALIDACION_FISICA.md`.

## Áreas con menor cobertura automatizada

| Módulo | Cobertura combinada |
|---|---:|
| launcher.py | 0 % |
| preflight.py | 0 % |
| local_tts_worker.py | 0 % |
| rvc_gpu_runner.py | 15,38 % |
| minecraft_connector.py | 52,90 % |
| local_tts.py | 53,60 % |
| obs_direct.py | 58,41 % |
| chatbot.py | 59,06 % |

El diagnóstico `launcher.py --check` sí se ejecutó correctamente por separado; no está incluido en la medición de cobertura de la batería. El 0 % del lanzador y del diagnóstico describe su cobertura por esas pruebas, no un fallo del comando ejecutado.

## Registros y reproducción

- `runtime/auditoria-python.log`: resultados individuales de Python.
- `runtime/auditoria-node-limitada.log`: ejecución completa JavaScript aprobada.
- `runtime/auditoria-cannon-resumen.json`: 20 repeticiones del cañón.
- `runtime/auditoria-cannon-05.log`: reproducción del tiempo agotado.
- `runtime/auditoria-cobertura.log` y `runtime/auditoria-cobertura.json`: cobertura por módulo.
- `runtime/auditoria-ruff.log`: análisis estático.
- `runtime/auditoria-arranque.log`: diagnóstico del servidor.
- `runtime/auditoria-estabilidad.json`: muestras HTTP locales.

Desde la raíz del proyecto, en PowerShell:

```powershell
$env:PYTHONPATH="$PWD/app;$PWD/tools"
python -m coverage run --data-file=runtime/auditoria-coverage -m unittest discover -v -s tests -p 'test_*.py'
python -m coverage report --data-file=runtime/auditoria-coverage
$testFiles=Get-ChildItem tests/test_*.cjs | ForEach-Object FullName
node --test --test-timeout=30000 @testFiles
node --test --test-timeout=2000 tests/test_gift_cannon.cjs
python -m ruff check .
python app/launcher.py --check
python tools/soak_test.py --seconds 60 --interval 5 --output runtime/auditoria-estabilidad.json
```

La incidencia del cañón es intermitente: una sola ejecución aprobada no demuestra que esté resuelta.
