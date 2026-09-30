# Pruebas del 27 de agosto de 2026

Ventana de observación: aproximadamente 20:40–20:44, hora local del equipo.
No se abrió ningún programa de streaming ni se verificaron sus fuentes en el navegador durante esta ronda.
La transmisión activa no se reinició ni se desconectó. No se enviaron mensajes,
regalos o likes de prueba a TikTok.

## Aceptación automática sin el programa de streaming

Comandos reproducibles:

```powershell
python tools/run_tests_no_obs.py
node --test tests/test_frontend.cjs
```

**158 pruebas aprobadas: 127 Python y 31 JavaScript** en la validación del 31 de
agosto de 2026. El ejecutor Python excluye operaciones físicas del programa de streaming, audio y
red; esas verificaciones siguen requiriendo el equipo real.

Cobertura: recepción y deduplicación, conteo de likes, rachas y diamantes,
recuperación HTTP, cancelación y reintentos con cliente simulado, filtros de
seguidores/usuarios, prioridades y límites de voz, pausa lógica por micrófono,
permisos del moderador, rotación/revocación/caducidad de claves, archivo y CSV.

### Carga aislada

- 10,000 comentarios: quedan los últimos 200, ordenados y sin duplicar el último.
- 5,000 eventos de likes, cada uno repetido: total 10,000, 5,000 eventos únicos.
- 2,000 rachas de regalos con actualizaciones y duplicados: 6,000 unidades;
  cachés limitadas a 1,000 identificadores y 100 filas visibles.
- 1,000 comentarios en SQLite temporal: recuperados íntegros tras reabrir.

Estas cargas no representan una prueba de horas de duración ni reproducción
física de cortes de red. Usan procesos y archivos temporales separados del live.

## Comprobaciones reales

| Área | Resultado |
| --- | --- |
| Live | Conectado a `@wings667_` durante toda la observación. |
| Likes | Se observó un evento real y el contador pasó de 7,066 a 7,067. Coincidió con la pantalla. Esto no garantiza igualdad con la app oficial en todas las salas. |
| Espectadores | Se observaron cambios entre 61 y 69; valor final de pantalla: 64. |
| Comentarios | Pasaron de 8 a 15; pantalla con 15 tarjetas al finalizar. |
| Voz | Se observó “Leyendo” y después “Voz activa · cola: 0”, sin errores capturados. La audibilidad física requiere confirmación del usuario. |
| Traducción | El motor se inicializó y tradujo `Hello everyone` a `Hola, todos`. La prueba no añadió mensajes al chat. No se evalúa calidad general con una sola frase. |
| Historial | En una captura: 14 comentarios únicos, todos los IDs del feed archivados; resumen: 14. CSV y JSON con 24 registros, incluyendo muestras. El live continuó recibiendo mensajes. |
| Preguntas | Se mostraron seis preguntas reales con sus conteos. No se marcaron como respondidas durante la prueba. |
| JavaScript | Sin errores capturados en el navegador al comienzo y al final. |

### HTTP concurrente

40 lecturas de `/feed`, concurrencia 4: todas válidas y sin cambio de sesión.
Con `127.0.0.1`: **0.125 segundos en total**. Con `localhost` desde Python:
20.515 segundos. La diferencia es compatible con resolución/conexión local
(por ejemplo, intento IPv6), pero no se diagnosticó su causa definitiva.
No atribuir ese tiempo al procesamiento del servidor sin más mediciones.

## Pendientes que requieren participación o entorno externo

- **Micrófono físico:** apagado; se solicitó autorización para activarlo y hablar.
  La lógica de pausa pasó pruebas simuladas, no la captura física.
- **Sonido audible:** falta confirmar que la lectura se escucha por la salida correcta.
- **Regalos reales:** no se recibió ninguno durante esta observación. Conteo y
  rachas sí pasaron pruebas simuladas. No es necesario comprar regalos para ellas.
- **Moderador en otro dispositivo:** permisos y claves aprobados en clientes
  simulados; falta la prueba de red desde teléfono u otro equipo. No se generó
  una clave real ni se abrió el firewall durante esta ronda.
- **Sesiones prolongadas y pérdida física de red:** no se ejecutaron para evitar
  cortar la transmisión activa. Reintentos/cancelación probados de forma aislada.
- La búsqueda, respaldos, restauración, retención e instalador/lanzador ya están
  implementados. La validación física prolongada del programa de streaming, audio y red sigue pendiente.

el programa de streaming queda fuera de la validación solicitada.
