# TikReader — Comentarios reales de TikTok Live

## Mejoras de control e historial

- **Voz y traducción:** la tarjeta de cola muestra el texto que se está leyendo,
  pendientes y motivos de omisión. Adelantar respeta la lectura actual; Retirar
  quita un pendiente; Para después guarda hasta 30 durante la conexión. Leer después
  ahora es una elección manual, no una nueva lectura automática filtrada.
- **Conexión:** diferencia el total mostrado, la última cifra informada por la sala
  y las unidades sumadas de eventos recibidos desde la conexión. Estas últimas no
  garantizan representar todos los likes. Muestra la antigüedad del último evento.
- **Historial y análisis:** busca literalmente por texto y usuario (máximo 100
  resultados). Crear respaldo guarda una copia consistente de SQLite en
  `data/backups` y solicita su descarga. Puede contener nombres y comentarios:
  guárdala de forma privada. No hay restauración automática desde la interfaz.
- **Eliminación selectiva:** selecciona una sesión, pulsa Eliminar sesión seleccionada
  y escribe ELIMINAR. Antes del borrado se crea un respaldo. La sesión cargada en
  el servidor está protegida. No se han borrado sesiones reales durante las pruebas.
- **Moderación:** las preguntas preparadas se pueden marcar atendidas, reabrir o
  descartar. El moderador ve si una pregunta está preparada o respondida.
- **Ajustes y perfiles:** tamaño del texto del chat, alto contraste y controles
  grandes se guardan en este navegador. Alt+1/2/3 abre Transmisión/Voz/Preguntas;
  existe un enlace de teclado para saltar directamente al contenido.

## Lanzador y estabilidad

Abre **Iniciar TikReader.cmd** con doble clic. Comprueba dependencias y reutiliza el
servidor si ya está funcionando. Si el puerto pertenece a otro servicio, informa
el problema y no mata procesos. Si el servidor terminó, vuelve a ejecutar el
lanzador. No instala dependencias automáticamente ni reinicia un live activo.

```powershell
python app/launcher.py --check
python app/launcher.py --no-browser
python tools/soak_test.py --seconds 14400 --interval 15 --output soak-4h.json
```

La prueba prolongada solo lee el feed y el estado; no simula compras ni corta
conexiones. Usa `--pid NUMERO` para medir RSS del servidor si `psutil` está instalado.
El informe se actualiza durante la ejecución y distingue `running` de `finished`.
No verifica sonido audible ni micrófono ni sustituye una prueba de un live activo.
Una muestra con `connected: false` solo comprueba el servidor en reposo. No ejecutes
dos pruebas con el mismo nombre de informe. Una prueba se puede detener con Ctrl+C
si se ejecuta en consola; el informe quedará marcado como en curso.

Verificación de esta actualización: 58 pruebas automáticas sin el programa de streaming aprobadas
(40 Python y 18 JavaScript). Prueba corta HTTP de 60 segundos: 13 muestras, sin
errores. Se inició una prueba de cuatro horas en segundo plano: consultar
`soak-4h.json` para su progreso y resultado; no se da por aprobada mientras esté en curso.

## Instalación y ejecución

Usa Python con las dependencias del proyecto:

```powershell
python -m pip install -r requirements.txt
python app/server.py
```

Abre http://localhost:5000 e ingresa el usuario de una transmisión activa
(sin URL ni nombre visible). Pulsa Conectar. Detener también cancela una
conexión pendiente. No se generan comentarios de ejemplo.

Después de cambiar el código, detén el servidor con Ctrl+C, vuelve a ejecutar
`python app/server.py` y recarga la página.

## Diagnóstico

- `/version` muestra la versión instalada de TikTokLive.
- `/status` muestra el usuario y si está conectando o conectado.
- Si hay un error, revisa el panel de la página y la terminal.
- Un tiempo de espera agotado no prueba que el usuario esté fuera de línea.
  La conexión depende también de TikTok, la red y el servicio de firma que
  utiliza TikTokLive. No se garantiza acceso a transmisiones restringidas.
- Solo aparecerán comentarios nuevos que lleguen durante la conexión.
- Likes usa el total acumulado que informa TikTok; si el evento no incluye
  un total, suma su cantidad de likes. Al conectar y cada 30 segundos consulta
  también la sala para inicializar likes y espectadores. Los eventos actualizan
  los contadores en vivo. Un cero informado es distinto de un dato pendiente.
  La API pública puede devolver likes distintos de la aplicación de TikTok;
  el panel identifica la fuente, sin inventar cantidades.

## Pruebas

```powershell
python -m unittest -v test_server
node --test tests/test_frontend.cjs
```

Las pruebas usan un cliente simulado, no prueban disponibilidad de TikTok.
El servidor escucha en 0.0.0.0:5000; puede ser accesible desde la red local.
No lo publiques en Internet sin autenticación y configuración de producción.

## Conexión y rendimiento

### Chat unificado de YouTube y Twitch

Debajo de la conexión de TikTok abre **Conectar también YouTube o Twitch**. Las
plataformas se pueden usar solas, junto con TikTok o simultáneamente entre sí.
Los comentarios muestran una etiqueta de origen y entran al flujo normal de voz,
filtros, puntos, juegos, reglas, peticiones musicales e historial.

- **YouTube Live:** pega la URL o el ID del video e ingresa una clave de YouTube
  Data API v3. El video debe estar en vivo y tener el chat habilitado. La conexión
  lee mensajes nuevos, membresías observables y Super Chats. El importe se muestra
  como lo entrega YouTube y no se convierte a diamantes de TikTok.
- **Twitch:** ingresa el canal, el usuario propietario del token y un token OAuth
  con el permiso `chat:read`. Se leen mensajes y avisos de suscripción disponibles
  en el chat IRC de Twitch.
- Las claves y tokens no se escriben en la base de datos, respaldos, diagnósticos
  ni almacenamiento del navegador. Hay que volver a ingresarlos al reiniciar.
- Detener una tarjeta desconecta solo esa plataforma. El botón general **Detener**
  desconecta todas. La versión actual no publica mensajes en estas plataformas.
- Kick no forma parte de esta entrega; el administrador de conectores permite
  incorporarlo posteriormente sin cambiar el flujo del chat.

Referencias oficiales: [YouTube Live Chat API](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list)
y [Twitch IRC](https://dev.twitch.tv/docs/chat/irc/).

### Likes y regalos

- Likes inicia en `0` con cada conexión y toma el valor informado en cuanto
  llega un dato de la sala o un evento; el panel indica cuántos eventos llegaron
  y la hora de la última actualización.
- Regalos suma unidades. Las rachas con identificador de grupo actualizan
  una sola fila sin volver a sumar las unidades anteriores; sin identificador
  de grupo se espera el mensaje final de la racha.
- El panel conserva los últimos 100 envíos o rachas con usuario, nombre del
  regalo, cantidad, estado y hora. No reconstruye regalos anteriores que
  TikTok no haya enviado al cliente.
- Likes, regalos e historial se recuperan por HTTP si se pierde una emisión
  del WebSocket. Una recarga no borra los datos del servidor. Reiniciar borra
  los contadores en memoria, pero no el archivo de sesiones guardadas.
- La terminal registra `[Likes]` y `[Regalos]` para distinguir un evento no
  recibido de un problema de visualización. No es necesario comprar regalos
  para ejecutar las pruebas automatizadas.

### Recuperación

- Los fallos de red, WebSocket y tiempo de espera tienen hasta 3 reintentos
  automáticos, tras 2, 5 y 10 segundos. Detener cancela también la espera.
- No se reintenta automáticamente un usuario fuera de línea, una denegación
  de autenticación o un límite de solicitudes. Revisa el error antes de repetir.
- Los reintentos conservan comentarios y contadores. Cambiar de usuario
  inicia una sesión nueva. Volver a pedir el mismo usuario activo no lo reinicia.
- El WebSocket entrega comentarios de inmediato. La recuperación HTTP pide
  solo mensajes posteriores al último punto sincronizado, cada 3 segundos en
  primer plano y 15 segundos con la pestaña oculta.
- La recuperación inmediata conserva hasta 200 comentarios y 1000 identificadores
  para detectar duplicados. Las pausas largas pueden superar esa ventana;
  consulta el archivo de sesiones para los mensajes anteriores recibidos.
- El silencio en el chat no dispara reconexiones: puede ser normal que no
  haya comentarios nuevos. La reconexión responde a errores de transporte.

## Panel de estudio

- Comentarios a la izquierda, regalos en columna independiente a la derecha.
  Las pestañas laterales organizan ranking, voz/filtros e historial/el programa de streaming.
- Voz del navegador: activación manual, voz, velocidad, volumen, pausa y salto.
  No lee automáticamente el historial recuperado. La cola está limitada a 30.
  La disponibilidad y calidad de voces depende del sistema y navegador.
- Filtros locales: búsqueda, preguntas, palabras bloqueadas y repetidos del
  mismo usuario durante 10 segundos. Puedes omitir emojis al leer en voz alta.
  Estos filtros no moderan ni eliminan mensajes en TikTok.
- Cada comentario permite destacar, marcar respondido y leer individualmente.
- Ranking por unidades regaladas o diamantes informados durante la sesión,
  no por valor monetario. Si TikTok no informa diamantes se indica sin datos.
- Alertas para regalos, likes, seguidores, compartidos y suscripciones, con
  animación, audio, filtros y prueba directa en la fuente de transmisión.
  Se activan manualmente; la prueba no agrega eventos ni contadores.
- Alt+P pausa/reanuda voz, Alt+N salta lectura y Alt+D destaca el último comentario
  visible. No se ejecutan mientras escribes en un campo.
- Preferencias locales en el navegador; voz y alertas requieren activación después
  de recargar para evitar sonidos inesperados.

## Puntos, niveles y Minecraft

En **Sistema → Puntos y niveles** activa la moneda y define cuánto entrega cada
evento. Los saldos y puntos históricos se guardan en SQLite; el nivel se calcula
con los puntos históricos y no baja al hacer ajustes negativos. El multiplicador
de suscriptor comienza a aplicarse cuando TikTok entrega una notificación de
suscripción observable durante una conexión. Restablecer todos los saldos exige
escribir `RESTABLECER PUNTOS`.

En **Producción → Juegos → Minecraft** configura RCON de Minecraft Java. En
`server.properties` habilita `enable-rcon=true`, asigna `rcon.password` y revisa
`rcon.port` (normalmente 25575). TikReader acepta únicamente localhost o una IP
privada. Guarda alias con el formato `alias = comando`, autoriza la conexión y
prueba un alias. La contraseña permanece solo en memoria y se borra al reiniciar.
Después crea una regla en Interactividad con la acción **Comando autorizado de
Minecraft** y usa como valor el alias. Los comandos admiten `{user}`, `{gift}` y
`{count}`; la emergencia cancela las acciones pendientes.

## Historial y el programa de streaming

Los comentarios y regalos recibidos se guardan localmente en
`data/history.sqlite3`. La pestaña Historial permite ver sesiones y exportar
JSON o CSV. No reconstruye eventos anteriores a la conexión. El archivo puede
contener nombres y comentarios de espectadores: conserva y comparte con cuidado.
No hay borrado automático; respalda la base y considera su crecimiento.

En el programa de streaming puedes agregar fuentes Navegador independientes:

- Likes: `http://localhost:5000/overlay/likes`
- Regalos: `http://localhost:5000/overlay/gifts`
- Ventana completa compatible con escenas anteriores: `http://localhost:5000/overlay`

Separar likes y regalos permite colocarlos, escalarlos y ocultarlos de forma independiente en OBS o LIVE Studio.
El fondo es transparente y muestra comentarios, destacado, último regalo y metas.
Las metas se configuran en Historial / el programa de streaming y se guardan entre reinicios.
El servidor debe permanecer abierto. La integración se verifica en navegador;
comprueba tamaño, audio y composición dentro de tu instalación del programa de streaming.

## Estudio, perfiles y ventanas independientes

### Menú lateral

La pantalla Transmisión contiene solo conexión, contadores, chat, voz rápida y
regalos. Los ajustes se abren en páginas independientes: Voz y traducción,
Filtros, Escenas y privacidad, Alertas, el programa de streaming, Historial, Moderador, Revisión previa,
Conexión y Perfiles. En pantallas pequeñas usa el botón Menú.

### Controles de producción

- **Micrófono:** en Voz y traducción pulsa Activar micrófono y concede permiso.
  El análisis de volumen ocurre en el navegador, sin grabar ni enviar audio.
  Pausa la síntesis mientras hablas y espera 900 ms de silencio antes de liberarla.
  Ajusta el umbral; usa auriculares para evitar que la propia lectura active la pausa.
  Desactivar o cerrar la página libera el dispositivo. No se activa al recargar.
- **Emergencia:** Silenciar y ocultar el programa de streaming cancela voz, alertas y cola local; las
  fuentes web se ocultan al sincronizar (normalmente hasta 1 segundo). Si el servidor
  no responde, el panel avisa que no pudo confirmar la ocultación. Reanudar voz y efectos
  libera el bloqueo; no reproduce mensajes descartados. No detiene TikTok ni el programa de streaming.
- **Escenas:** Inicio, Charla, Pausa y Despedida cambian las fuentes web y bloquean
  lectura fuera de Charla. No cambian escenas nativas del programa de streaming. Usa la fuente
  `/widget/announcement` para los títulos de escena y respuestas en pantalla.
- **Privacidad:** puede ocultar fotos y nombres de espectadores en las fuentes del programa de streaming
  y redactar enlaces, correos y secuencias que parecen teléfonos en el programa de streaming y voz.
  Es una detección aproximada, no una garantía de anonimización. El panel privado
  y el archivo local conservan los originales. Las vistas públicas usan endpoints
  sanitizados; no uses el panel principal como fuente del programa de streaming si quieres anonimizarlo.
- **Preguntas:** agrupa coincidencias normalizadas (acentos, puntuación y mayúsculas),
  cuenta personas y mensajes y permite marcar respuestas. No agrupa sinónimos con IA.
- **Marcadores:** guarda descripción, hora y segundos desde el inicio de conexión.
  Puedes marcar globalmente o desde Más en un comentario. Se exportan en el JSON
  de la sesión. No graba video ni conoce cuándo comenzó la grabación del programa de streaming.
- **Saturación:** cola configurable de 1 a 30 lecturas (10 por defecto), con contador
  de lecturas omitidas por límite o antigüedad. No elimina comentarios del historial.
- **Respuestas rápidas:** guarda hasta 20 textos en este navegador y muéstralos en
  las fuentes web. No publica automáticamente en TikTok.
- **Comparación:** Historial compara hasta 10 sesiones por comentarios, preguntas,
  participantes, unidades de regalo y pico de espectadores observado. No rellena
  datos de espectadores ausentes en sesiones antiguas.
- **Revisión previa:** comprueba servidor, live, archivo, datos disponibles, voz,
  volumen y rutas de fuentes del programa de streaming. Los botones de prueba no añaden eventos al live.
  Comprueba manualmente que el programa de streaming reciba el audio y que el micrófono físico funcione.

### Traducción

Integración con [Translator API del navegador](https://developer.chrome.com/docs/ai/translator-api).
Selecciona idioma original (inglés, portugués, francés o alemán) y prepara el motor
para español. Puede descargar un modelo con esa acción. No se envían comentarios
a una API de pago. Usa Más → Traducir, o activa Leer traducción en lugar del original.
Se limita el trabajo pendiente a 5 traducciones. Si falla, se conserva el original
y se muestra el error. No se garantiza disponibilidad en el navegador integrado:
durante la verificación el motor no pudo inicializarse. Requiere un navegador y
un modelo compatibles; la traducción efectiva queda pendiente de esa dependencia.

### Moderador limitado y seguridad

El panel principal, el historial y las operaciones de administración solo aceptan
conexiones desde este equipo (loopback). En Moderador genera una clave temporal
de 8 horas y compártela tú con una persona de confianza. Esa persona abre
`http://IP-DEL-EQUIPO:5000/moderator` en la red privada e introduce la clave.
No se guarda en almacenamiento del navegador ni se incluye en URLs. Revocar o
generar otra clave invalida la anterior; reiniciar el servidor también la invalida.

El moderador solo puede ver comentarios recientes, preparar preguntas y destacar
mensajes. No puede iniciar/detener el live, cambiar metas ni acceder al historial.
Las pruebas verifican restricciones con clientes HTTP simulados; no se ha abierto
el firewall ni probado acceso físico desde otro dispositivo.
HTTP no cifra la clave: usa únicamente una red privada de confianza o configura un
túnel HTTPS de confianza. No expongas este servidor de desarrollo a Internet.

Pruebas ampliadas: `python -m unittest -q test_server test_production` y
`node --test tests/test_frontend.cjs`.

En Voz y filtros marca **Elegir quién se lee en voz alta** para limitar la lectura
de comentarios a seguidores confirmados, usuarios indicados por @nombre o modo
manual. Sin marcar se mantienen todos los comentarios que pasan los otros filtros.
La lista admite comas, espacios y punto y coma, y compara nombres completos sin
distinguir mayúsculas. Los datos de seguidores ausentes no cuentan como confirmados.
El botón Leer de cada comentario es una elección manual y permite leerlo aunque no
cumpla la selección automática. Cambiar la selección vacía la cola pendiente; una
lectura ya iniciada se puede cortar con Saltar. Las alertas de regalos son independientes.
La configuración se conserva en el navegador y en los perfiles guardados.

- La barra de voz permanece junto al chat: activar/reactivar, apagar, pausar y
  saltar. La preferencia se recuerda, pero después de abrir o recargar se requiere
  un clic en Reactivar voz. Los errores de síntesis se muestran en esa barra.
- Prioridad de lectura: orden de llegada, preguntas, usuarios elegidos o regalos.
  La lectura actual no se interrumpe; la prioridad organiza lo que sigue. Se omiten
  mensajes que superan la espera máxima configurada (45 segundos por defecto).
- En Estudio ajusta el ancho del chat o activa el modo presentador con letras grandes.
  El botón Salir del modo presentador permanece accesible.
- Guarda perfiles con voz, filtros, alertas, metas y distribución. Se guardan en
  este navegador, no en la cuenta de TikTok ni entre equipos. Cargar un perfil no
  cambia el usuario conectado. Guardar con el mismo nombre reemplaza el perfil.
- Conexión muestra las últimas recepciones y la fuente de likes. Una consulta de
  sala con más de 90 segundos sin actualizar se advierte sin asumir que acabó el live.
- Historial incluye resumen de mensajes, participantes activos, regalos y muestras
  de espectadores cada 30 segundos. El pico es observado, no el pico oficial de TikTok.
  Las sesiones antiguas no tendrán muestras anteriores a esta actualización.

Desde Estudio usa Separar para abrir un panel en otra ventana (si el navegador
permite ventanas emergentes), Abrir para una pestaña o Copiar URL para el programa de streaming.
En una fuente Navegador del programa de streaming pega una de estas direcciones:

| Panel | Dirección | Tamaño inicial sugerido |
| --- | --- | --- |
| Chat | `http://localhost:5000/widget/chat` | 480 × 800 |
| Regalos | `http://localhost:5000/widget/gifts` | 480 × 800 |
| Ranking | `http://localhost:5000/widget/ranking` | 480 × 600 |
| Contadores | `http://localhost:5000/widget/stats` | 600 × 260 |
| Metas | `http://localhost:5000/widget/goals` | 480 × 280 |
| Destacado | `http://localhost:5000/widget/highlight` | 600 × 240 |

Las vistas comparten la conexión del servidor, tienen fondo transparente y no
generan voz, para evitar lecturas duplicadas. Sin regalos o destacado, su vista
queda vacía. Puedes agregar `?theme=light` para tarjetas claras, `?limit=5` para
limitar filas o `?sort=diamonds` al ranking. Combina opciones con `&`.
Mantén el estudio principal abierto para controlar voz y conexión; el programa de streaming requiere
capturar por separado el audio del navegador si quieres transmitir la lectura.

## Organización y recuperación (actualización)

El menú tiene cinco accesos principales: En vivo, Voz, Moderación, Historial y
Configuración. Cada grupo conserva sus herramientas secundarias en «Más opciones».
Los perfiles existentes se encuentran en Configuración y se guardan por navegador.

Voz incluye un asistente que informa de lectura desactivada, volumen cero, falta de
voces y filtros de audiencia. La comprobación de sonido requiere escuchar la prueba;
no detecta automáticamente un altavoz silenciado o una salida de audio equivocada.

Historial permite validar un respaldo SQLite de hasta 25 MB y recuperar registros
faltantes escribiendo RESTAURAR. No sobrescribe registros existentes, no modifica la
sesión actual ni importa ajustes del respaldo. Se guarda una copia de seguridad
antes de combinar datos. La limpieza por antigüedad es MANUAL: consulta la vista
previa, elige 7/30/90/365 días y escribe LIMPIAR seguido del número. Los respaldos
no se eliminan automáticamente y su tamaño se incluye en el espacio mostrado.

Configuración > Más opciones > Conexión y diagnóstico permite descargar un JSON
con métricas y disponibilidad. Excluye nombres, comentarios, credenciales y logs
completos. Los detalles técnicos están plegados por defecto.

### Regresión automática sin el programa de streaming

Ejecuta `python tools/check_changes.py` para la suite completa sin el programa de streaming o
`python tools/check_changes.py --watch` para repetirla al guardar cambios en fuentes.
El modo watch se mantiene abierto hasta Ctrl+C. No conecta TikTok ni compra regalos.
Verificación de esta actualización: 42 pruebas Python + 18 JavaScript aprobadas,
comprobación sintáctica de todos los archivos JS y prueba HTTP de 10 segundos con
6 muestras y cero errores. Navegador: navegación, asistente de audio, perfiles y
vista previa de espacio comprobados; sin eliminación de historial real.

La prueba prolongada anterior se interrumpió para desplegar esta actualización:
`soak-4h-before-update.json` conserva su resultado parcial. Se inició de nuevo la
prueba de cuatro horas en `soak-4h.json`. Hasta que su estado sea finished no debe
considerarse completada. Sin un LIVE conectado solo mide estabilidad en reposo.
Falta comparar contadores/regalos con TikTok y escuchar la voz durante un LIVE real.

## Interactividad: alcance de la primera entrega

En vivo > Más opciones > Interactividad contiene hasta 50 reglas persistidas:
comentario, regalo, likes, seguidor, compartido o notificación de suscripción;
acciones de texto animado, voz fija, sonido WAV, segundos de temporizador y
Streamer.bot local. Las reglas nuevas están desactivadas. Puedes editar, activar,
desactivar o eliminar cada regla. El filtro busca texto literal sin distinguir
mayúsculas. El intervalo es por regla, no por usuario; un regalo en racha puede
activar cada incremento si vence el intervalo, no necesariamente una vez por racha.

La biblioteca admite WAV de hasta 5 MB y 50 MB acumulados. Los efectos se muestran
en el estudio, NO hay todavía una fuente del programa de streaming de interactividad. Los sonidos deben
habilitarse por pestaña; mantener un solo estudio con audio evita duplicación.
El temporizador limita el tiempo restante a 24 horas y no persiste al reiniciar.
Las acciones se suspenden en emergencia o fuera de la escena Charla.

Streamer.bot usa exclusivamente POST http://127.0.0.1:7474/DoAction con un GUID
configurado por el operador. Requiere habilitar HTTP en Streamer.bot y escribir
AUTORIZAR STREAMERBOT. No se habilita automáticamente al reiniciar; no reintenta
acciones fallidas y no ejecuta texto del chat como comando. No fue probado contra
una instalación real. Protocolo: https://docs.streamer.bot/api/http/requests/do-action

PENDIENTES, no implementados: OAuth y peticiones musicales Spotify; chatbot que
publique en TikTok; emotes/niveles como condiciones; adaptadores nativos Minecraft,
GTA V, Voicemod, IFTTT y teclas; videos, sonidos aleatorios y minijuegos/overlays
interactivos. Streamer.bot es un puente disponible, no sustituye esos adaptadores.
Spotify exige cuenta Premium para controlar la cola:
https://developer.spotify.com/documentation/web-api/reference/add-to-queue

Verificación: 48 pruebas Python y 18 JavaScript aprobadas; sintaxis JS/Python;
interfaz de reglas abierta sin errores de JavaScript. No prueba el programa de streaming, compras,
conexiones externas ni eventos de un LIVE real. La prueba prolongada se reinició
para este servidor; el parcial anterior está en soak-before-interactivity.json.

## Refuerzos de interactividad

Cada regla permite un máximo por usuario (5 por defecto) y un presupuesto por sesión
(100 por defecto). Se cuentan activaciones, no dinero ni diamantes. Las identidades
se normalizan sin @ y sin distinguir mayúsculas. Usuarios sin identidad comparten
el grupo unknown. Reiniciar el servidor o cambiar de sesión reinicia los límites.

El simulador usa las reglas guardadas y explica filtro, intervalo, estado y límites:
no ejecuta efectos, no llama a Streamer.bot ni consume presupuestos. Importar añade
reglas con IDs nuevos y desactivadas de forma atómica; exportar incluye JSON versión
1, no audios ni autorizaciones. Un audio referenciado no puede eliminarse. La
biblioteca ofrece reproducción manual y eliminación con confirmación.

Las secuencias admiten hasta cinco pasos adicionales en JSON. Se despachan en orden;
NO esperan a que termine un sonido o una acción externa. Es una secuencia de envío,
no una línea de tiempo audiovisual. El editor visual y las esperas quedan pendientes.

El servidor concede a una sola pestaña un permiso temporal de audio automático,
renovado periódicamente. Sin permiso se pausa la voz y se bloquean sonidos automáticos.
Las reproducciones manuales de la biblioteca no participan en este permiso. La
validación automática comprueba exclusión y caducidad; falta una prueba audible con
varias pestañas y un LIVE. Se requiere mantener el servidor disponible.

Verificación: 54 pruebas Python y 18 pruebas JavaScript; límites, simulación sin
efectos, importación atómica, orden de pasos, eliminación protegida y permiso de audio.
No hay un LIVE conectado ni servicio accesible en 127.0.0.1:7474 para comprobar
Streamer.bot real. No se realizaron pruebas del programa de streaming. La prueba prolongada anterior
no terminó: parcial en soak-before-hardening.json. La nueva usa
soak-hardening-4h.json; revisar status y errors antes de declararla aprobada.

## Secuencias visuales, panel y Spotify

Interactividad ahora permite agregar, subir y quitar pasos visualmente. Cada paso
adicional tiene una espera de 0 a 60 segundos respecto al anterior. El servidor
mantiene hasta 200 pasos pendientes; los cancela al cambiar de sesión o entrar en
emergencia/escena sin emisión. Desactivar o eliminar una regla evita sus pasos
pendientes. Las esperas son temporales: no esperan confirmación de fin de sonido o
programa externo. El registro 'ejecutada' puede significar pasos programados.

Nuevas acciones: video MP4 sin audio (hasta 20 MB por archivo; 100 MB de videos) y
WAV aleatorio (entre uno y cinco nombres de archivos separados por coma). Los WAV
referenciados por selección aleatoria están protegidos contra eliminación.

Panel separable: /widget/interactive, con texto animado, videos sin audio,
temporizador y resultados de encuestas. No reproduce voz ni sonidos para evitar
copias. Los efectos nuevos reemplazan al anterior; los videos se limitan a 30 s.
Este panel NO se probó en el programa de streaming por la exclusión solicitada.

Encuestas: entre dos y seis opciones, una respuesta por identidad normalizada.
El espectador escribe el número exacto de su opción. No se admiten identidades
ausentes; límite de 10000 votantes. Cerrar mantiene resultados. Se borran al
reiniciar/cambiar de sesión. No hay ruleta ni otros minijuegos todavía.

Spotify: implementado OAuth PKCE, renovación de token en memoria, desconexión,
peticiones !song con enlace de pista, aprobación/rechazo manual y salto de canción.
Requiere Client ID propio, cuenta Premium y dispositivo activo. Registrar la URI
http://127.0.0.1:5000/spotify/callback en el panel de Spotify. Abrir el estudio en
http://127.0.0.1:5000 para conectar (la cookie de autorización no se comparte con
localhost). Los tokens no se guardan en disco ni se exportan. Máximo 30 peticiones
pendientes y una por usuario. No hay búsqueda por nombre ni reproducción interna.
No se autorizó una cuenta ni se probó la API real. Conectar no otorga derechos para
retransmitir música. Referencias oficiales:
https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
https://developer.spotify.com/documentation/web-api/reference/add-to-queue

Verificación: 60 pruebas Python y 18 JavaScript aprobadas; editor visual guardado,
editado y regla temporal retirada. Sin el programa de streaming ni acciones externas reales.
Prueba de estabilidad corregida para usar el PID real del servidor, no el lanzador
Windows: soak-sequences-server-4h.json. El informe anterior se conserva como
soak-sequences-wrapper.json y no valida memoria del servidor.

Aún pendientes: chatbot que publique en TikTok mediante una vía compatible,
condiciones por emotes/niveles, adaptadores nativos de juegos, Voicemod e IFTTT,
y comprobación LIVE real. Streamer.bot sigue siendo un puente, no estos adaptadores.

## Herramientas de operación y mantenimiento

Revisión previa ahora incluye voz, reglas activas, archivos faltantes, conflictos
potenciales y autorizaciones. No abre paneles del programa de streaming ni ejecuta audio. La detección de
conflictos es conservadora por evento y filtros contenidos; no prueba todas las
combinaciones de texto ni configura servicios externos.

Configuración > perfiles guarda voz, disposición del estudio, accesibilidad, metas,
reglas y privacidad. Los perfiles antiguos siguen siendo compatibles. Cargar un
perfil completo valida archivos primero, desactiva reglas y conectores, silencia
la emisión y limpia pasos pendientes. Después revisa y restaura emisión manualmente.
No incluye tokens Spotify, historial ni posiciones de ventanas externas.

Interactividad contiene secciones plegables de conflictos/omisiones y botonera.
Actualizar botonera muestra las reglas existentes. Vista previa privada devuelve
solo datos a esta pestaña: permite revisar texto, tamaño y reproducir medios con
controles manuales. No publica efectos ni llama a programas externos. El tamaño y
volumen de prueba no cambian las reglas. Ejecutar regla requiere confirmación,
regla activa y emisión no silenciada; respeta intervalos y presupuestos. La prueba
privada de voz/temporizadores/acciones externas muestra su descripción sin ejecutarlos.

Las omisiones se agregan por causa (filtros, intervalo, límites, cola llena) desde
el inicio del servidor. No son un registro ilimitado por espectador. Historial
ofrece resumen final descargable sin nombres, mensajes ni identificadores. Una
transición de conectado a desconectado prepara un resumen provisional; también
puede ocurrir durante reconexiones. Errores históricos previos a esta versión no
pueden reconstruirse. La retención sigue siendo manual, con confirmación y respaldo.

El temporizador se guarda aproximadamente cada 10 segundos y vuelve pausado al
reiniciar. Las reglas se cargan desactivadas y el control de voz y efectos inicia sin pausa; no se retoman
pasos ni audios anteriores. Las colas y autorización externa no se recuperan.

tools/Instalar TikReader.cmd crea .venv e instala requirements.txt con confirmación,
Python instalado y acceso a Internet. Iniciar TikReader.cmd usa .venv si existe.
No es un instalador EXE autónomo ni firmado; no se instaló un entorno nuevo durante
esta comprobación.

app/maintenance.py backup crea un ZIP de código con manifest/checksums, excluyendo
historial, medios y credenciales. tools/Actualizar o recuperar TikReader.cmd solicita
un ZIP de confianza, confirmación ACTUALIZAR y exige el servidor detenido. Guarda
un respaldo antes de aplicar y restaura archivos anteriores si falla la escritura.
Para volver a una versión, aplica su ZIP de respaldo. No descarga actualizaciones,
no verifica una firma del autor ni modifica las dependencias automáticamente. Los
archivos añadidos por una versión posterior pueden permanecer al volver a una
anterior; solo se sustituyen los archivos declarados en el paquete. Las bases de
datos no se restauran con paquetes de código. Usa respaldos de historial para eso.

Pruebas de esta entrega: suite sin el programa de streaming, perfiles seguros, vista previa sin publicación,
confirmaciones, anonimización, paquetes inválidos y aplicación/restauración en
carpetas temporales. El resultado de estabilidad anterior quedó parcial en
soak-before-operator.json; la prueba nueva está en soak-operator-4h.json y requiere
finalizar antes de dar por aprobadas cuatro horas.

## Ayuda contextual

Los iconos circulares «i» del estudio explican los controles de voz, reglas,
secuencias, historial, privacidad, perfiles y conexión. Pasa el mouse o enfoca el
icono con Tab; también puedes tocarlo. Escape cierra la explicación. Puedes mover
el puntero sobre el tooltip para leerlo sin que desaparezca. Los iconos no activan
las casillas ni ejecutan las acciones que explican. La ayuda se añade también a
los controles dinámicos, sin duplicar iconos y conservando las etiquetas accesibles.

## Centro del LIVE y herramientas de uso diario

En vivo muestra conexión, voz, reglas, pasos pendientes y antigüedad del último
dato. No estima latencia de TikTok: un tiempo sin eventos puede ser normal.
La prueba guiada está en Revisión previa. Registra eventos posteriores al inicio,
distingue cambios de sesión y requiere confirmación humana para audio, comparación
de contadores y reconexión. Guardar conserva la última prueba local; Actualizar
comprobaciones permite recuperarla. No genera regalos ni prueba el programa de streaming.

Interactividad > Plantillas añade tres reglas iniciales desactivadas: agradecer
un regalo, responder en pantalla a !hola y añadir 30 segundos por regalo. Deben
revisarse antes de activar y no publican comentarios en TikTok.

Control de saturación permite Encolar, Reemplazar u Omitir mientras hay un efecto
activo. El estudio y panel interactivo usan la política guardada. Hay una cola
visual y otra de sonido con 10 pendientes cada una; descartan esperas superiores
a 30 segundos. El audio de reglas pausa la lectura mientras suena. La voz conserva
sus propios límites de cola. Cambiar política vacía las colas; no revoca acciones
externas enviadas. Los videos son silenciosos. La reproducción manual de archivos
no pertenece a estas colas. Las alertas básicas se omiten si hay audio de regla.

Gestor de archivos lista WAV/MP4 con etiquetas legibles, tamaño y número de pasos
que los usan. Las etiquetas no cambian los identificadores de las reglas. Puedes
previsualizar o eliminar archivos sin uso con confirmación. Los archivos
referenciados por reglas están protegidos; no se limpia nada automáticamente.

Configuración > Atajos configurables guarda Alt+Shift+letra para pausa, salto,
silencio y una regla elegida. Requieren el foco en la página, se ignoran al escribir
y no son atajos de Windows. Ejecutar la regla requiere confirmación y conserva
las autorizaciones y límites del servidor. No automatiza programas fuera del
conector previamente autorizado.

Validación de esta entrega: 74 pruebas Python y 22 JavaScript (incluida cola de
efectos), navegación de la guía, plantilla desactivada, política de saturación y
listado de archivos en navegador, sin errores JavaScript. No se marcó audio como
escuchado ni se afirmó recepción LIVE real. La prueba anterior quedó parcial en
soak-before-live-tools.json; la nueva es soak-live-tools-4h.json.

## Herramientas opcionales (actualización 2026-08-27)

- Configuración → Funciones visibles: Básico/Avanzado. Solo cambia visibilidad; no desactiva reglas en ejecución.
- En modo avanzado, Configuración → Borradores, límites y deshacer: cargar, editar, guardar y publicar. Publicar requiere confirmación, rechaza cambios concurrentes y cancela pasos pendientes. Hasta diez publicaciones pueden deshacerse mientras no haya modificaciones posteriores. Las reglas que se restauran conservan su estado habilitado; la emergencia nunca se desactiva automáticamente.
- El borrador incluye reglas, privacidad, efectos, etiquetas, límite global y caducidad. Los filtros de voz se aplican en la pestaña que publica; otras pestañas conservan sus filtros locales. El editor JSON está destinado al modo avanzado.
- Límite global inicial: 120 intentos de pasos por minuto (incluye temporizadores, sonidos, voz de reglas y acciones externas). No limita la lectura normal de comentarios. Caducidad externa inicial: 10 segundos desde que se encola; una solicitud ya enviada no puede cancelarse.
- Configuración → Registro de activaciones: últimos 500 resultados en memoria, solo al consultar. Se pierde al reiniciar.
- Historial → Ensayo privado de una sesión (avanzado): últimos 500 registros, un segundo virtual por registro. Analiza filtros de voz y coincidencias/límites de reglas; no reproduce audio, no ejecuta efectos y no simula retrasos ni antispam. No modifica historial ni estadísticas.
- Los nuevos perfiles incluyen política de efectos, etiquetas, límites, caducidad, atajos y modo de interfaz. Al cargar se mantiene el arranque seguro de perfiles.
- Voz → Diagnóstico de voz (opcional): revisión de bloqueos y confirmación manual de audio, sin ejecutar pruebas al abrir la aplicación.
- Configuración → Vista previa del diagnóstico de soporte: editar y descargar un JSON sin usuarios, comentarios, rutas ni credenciales. No lo envía a terceros.
- Una segunda instancia de app/server.py se rechaza usando un bloqueo del sistema operativo y comprobación del puerto 5000. No elimina procesos ajenos. Si ya hay una aplicación en el puerto, cierra esa aplicación conscientemente antes de iniciar TikReader.

Pruebas: `python tools/check_changes.py` (excluye el programa de streaming). `python tools/qa_optional_tools.py` abre un servidor de QA en el puerto 5001 con una base temporal y sin conexión a TikTok; no es el servidor de producción.

## Hotkeys de juegos

El apartado separado Juegos permite asociar el nombre exacto de un regalo con una
cantidad mínima, exacta o múltiplo. Cada acción puede tener una secuencia de hasta
diez combinaciones, duración, espera, prioridad, intervalo, límite por sesión,
perfil y aviso visual. La simulación en seco comprueba coincidencias sin pulsar
teclas. La prueba manual sí pulsa teclas y pide confirmación.

El modo al frente comprueba el título de la ventana justo antes de ejecutar. El
modo en segundo plano usa mensajes de Windows como mejor esfuerzo; muchos juegos
lo ignoran. TikReader no eleva permisos ni intenta eludir sistemas anti-cheat.
Las solicitudes caducan, la cola es limitada, la configuración conserva diez
respaldos y cada arranque elimina la autorización y desactiva las reglas guardadas.

Control reúne el estado solicitado, avisos recientes y controles independientes
de voz y hotkeys. La emergencia continúa siendo el interruptor maestro seguro:
silencia la voz y las fuentes públicas del programa de streaming hasta pulsar Reanudar voz y efectos.
Este panel no aparece como recorrido obligatorio al abrir la aplicación.



## Flujo sencillo: preparar sin LIVE

- **Stream → Personalizar** usa datos de ejemplo en la vista previa. No publica esos datos y no necesita que la emisión esté activa. Guardar aplica colores, fuente, tamaño, opacidad, bordes y distribución a esa ventana.
- **Juegos**: elige perfil, detecta la ventana (5 segundos), elige una plantilla y graba la tecla. `Prueba local, sin regalo real` permite guardar y probar sin catálogo. Esa opción nunca se activa con regalos del LIVE. Para regalos reales, selecciona el regalo, marca `Activa en LIVE` y guarda.
- La prueba manual conserva una espera mínima de 5 segundos. Requiere autorización temporal, emisión sin emergencia y ventana permitida. No envía regalos ni elude protecciones del juego.
- **Control** muestra qué falta y enlaces al apartado correspondiente. Spotify y Streamer.bot son opcionales; no bloquean las pruebas de Juegos.

## Estudio de alertas visuales

En **Alertas** puedes crear alertas de texto con PNG, JPG, GIF, WebP, MP4 o WebM, cambiar el color, tamaño, posición, duración y movimiento. También puedes usar los tonos incluidos, subir un sonido MP3 o WAV, ajustar su volumen o reproducir el audio del video. El editor compone una imagen o video y un texto; no es un editor de múltiples capas ni una línea de tiempo.

Usa `{usuario}`, `{evento}`, `{regalo}`, `{cantidad}` y `{diamantes}` en el texto. Puedes responder a regalos, likes, nuevos seguidores, compartidos o suscripciones. Los regalos admiten nombre, cantidad y valor mínimo en diamantes; los likes admiten cantidad mínima. Las plantillas son puntos de partida editables. La vista previa es privada y usa datos inventados.

Pulsa **Guardar desactivada**, revisa la lista y después **Activar para LIVE**, o usa **Activar todas para este LIVE**. Las alertas se desactivan al reiniciar. Los regalos se disparan una vez por racha; todos los eventos respetan la espera y la pausa de seguridad. Los archivos se guardan localmente (máximo 20 MB cada uno, 100 MB en total); no se admiten HTML ni SVG. Un archivo usado por una alerta no se puede eliminar.

Agrega `http://localhost:5000/widget/alerts` como fuente Navegador de 1080 × 1920 en tu programa de streaming. El bloque **Preparación de la transmisión** distingue la conexión al LIVE, la recepción de la fuente y las alertas activadas. **Enviar prueba a la transmisión** verifica el recorrido completo y sólo funciona cuando la fuente está abierta. La fuente no reproduce eventos antiguos al abrirla. Las alertas se encolan con hasta 10 pendientes; las que llevan más de 30 segundos esperando se descartan.

Verificación sin tocar la configuración real: `python tools/qa_studio.py` abre un entorno temporal en `http://127.0.0.1:5001`, con un juego y un regalo ficticios y un receptor de teclas simulado. Ciérralo con Ctrl+C. Para comprobar la recepción de regalos reales y la compatibilidad física del juego sí hace falta la prueba final durante un LIVE.
