# Estudio y comunidad

Abre **Creador → Escenas y comunidad** en TikReader. Las opciones también aparecen
en el modo básico. La cabina permanece abierta mientras preparas el directo, para
conservar los controles y la cola de voz.

## Escenas y galería

- La galería permite buscar overlays por nombre y carga las miniaturas de forma diferida.
- Crea escenas verticales u horizontales. Añade overlays, texto, paneles de color,
  imágenes y videos silenciosos. Las capas se pueden mover, redimensionar, ocultar,
  bloquear, duplicar y ordenar. Las flechas mueven la selección; Mayús cambia el paso.
- **Guardar borrador** conserva la distribución. **Publicar escena** actualiza la
  fuente de emisión. Cada escena tiene una URL independiente; úsala como fuente
  Navegador con las dimensiones que indica el editor.
- Deshacer conserva hasta 40 cambios de la edición actual. La importación y
  exportación JSON transportan la distribución; los archivos de imagen/video deben
  existir en el equipo de destino. No se incluyen dentro del JSON.
- Los estilos de cada widget se comparten con la galería. El borrador aísla la
  composición de la escena, no crea una copia de la configuración interna de cada widget.
- Límite: 40 escenas, 16 capas por escena. Imágenes/videos: 20 MB por archivo y
  100 MB en la biblioteca compartida de alertas. No se permite eliminar un archivo
  usado por un borrador o una escena publicada.
- La pausa de emergencia oculta las escenas. Una fuente sin conexión al servidor
  se vacía; no mantiene datos antiguos visibles indefinidamente.

## Comunidad

El informe usa el historial local de eventos, no los registros técnicos. Permite
filtrar cuenta y periodo, consultar aportaciones por mes, regalos, sesiones y
comentarios, y guardar etiquetas, notas y cumpleaños de cada participante.

Las rachas recuperadas con el mismo identificador no vuelven a sumar su valor.
Los regalos sin valor informado se señalan por separado. Las monedas observadas
no equivalen al ingreso neto del creador ni a un historial completo de TikTok.

El porcentaje del top 5 y las personas sin regalos observados en 30 días ayudan
a revisar la actividad. Las franjas muestran promedios de sesiones con regalos,
no recomendaciones causales ni una estimación de rentabilidad por hora.
Los nuevos regalos guardan hora absoluta; los registros antiguos usan la fecha
de sesión y quedan fuera del análisis horario. No hay borrado automático.

## Batallas

Con un LIVE conectado, se escuchan `LinkMicBattleEvent` y `LinkMicArmiesEvent` de
TikTokLive. Se guardan identificador, tiempo disponible, equipos, puntuaciones,
apoyos recibidos y finalización cuando el evento lo informa. No se derivan puntos
de batalla a partir de regalos. Se conservan las referencias entre reconexiones.

Puedes identificar tu equipo y anotar una referencia del rival. Si no llegan
nombres se muestran identificadores. El resumen de victorias/derrotas solo usa
batallas terminadas de dos equipos con tu lado identificado.

El marcador manual permite introducir rival, puntuaciones, duración y resultado.
El registro de potenciadores es manual: incluye propietario, nombre, caducidad y
estado usado. Ninguno de esos controles activa acciones en TikTok.

El overlay está en `/widget/battle`. Distingue datos de TikTok y registros manuales
y advierte de datos sin actualización reciente. Reiniciar no restaura una batalla
guardada como si continuara en vivo. Los avisos anticipados x2/x3, el inventario
automático de potenciadores y la reproducción de video de la batalla no están
implementados. El adaptador se probó con los mensajes de la versión instalada
(TikTokLive 7.0.0); falta la comprobación durante una batalla real.

## Calendario

Programa directos con fecha y hora local, duración, aviso previo, objetivos,
escena y perfil asociados. Los cumpleaños guardados aparecen en el calendario.
Abrir un evento no cambia automáticamente lo que se está emitiendo.

Los recordatorios de directos aparecen mientras la cabina de TikReader está
abierta. La exportación `.ics` permite importarlos en Google, Apple u otro
calendario; no crea una sincronización continua. No se consultan campañas
oficiales de TikTok ni calendarios de agencias.

## Perfiles y alertas

Charla, Gaming y Batallas ofrecen una vista previa de sus dos escenas y reglas.
Al añadirlos, las escenas quedan como borradores y las nuevas reglas desactivadas.
Repetir la operación no duplica las reglas ni reemplaza escenas personalizadas.

Los perfiles completos existentes en **Configuración** incluyen ahora borradores
de escenas. Cargarlos conserva las versiones publicadas y sigue el comportamiento
de arranque seguro de los perfiles existentes.

Voz y alertas incluye siete plantillas: agradecimiento de regalos por voz,
suscripción, bienvenida, compartidos, ruleta, alcancía y tiempo adicional con
`!otra`. También hay tres sonidos sintetizados localmente: Campana suave,
Subir de nivel y Celebración. Puedes escucharlos y añadir su regla de regalo.
Las reglas se editan y activan en Automatizaciones; las voces se eligen en Voz.

## Juegos del chat

- **Carrera por equipos:** cada participante elige una vez con `!rojo` o `!azul`.
  Unirse suma un punto. Opcionalmente, cada unidad de regalo recibida suma otro
  punto al equipo previamente elegido.
- **Trivia:** pregunta y respuesta configurables; cada persona acierta una vez.
  Se ignoran mayúsculas y espacios exteriores. La respuesta no se publica en el overlay.

Conecta el LIVE antes de iniciar la ronda. Los juegos duran entre 15 segundos y
30 minutos, se pueden terminar manualmente y se detienen al cambiar de sesión.
La emergencia bloquea nuevos puntos y oculta la salida. El overlay es `/widget/arena`.
Se mantienen los conectores de Minecraft, teclas y Streamer.bot existentes.
No se añadió una biblioteca de mods de terceros.

## Datos, límites y comprobación

Todo lo nuevo funciona localmente, sin cuentas nuevas ni servicios de pago.
No incluye almacenamiento en nube ni importación del formato de Tikfinity.
Las escenas, fichas, calendario, batallas y potenciadores se guardan en la base
de datos local. No se escribieron datos de ejemplo en el historial real.

La batería completa pasó con 276 pruebas Python y 116 JavaScript, sintaxis,
Ruff y cobertura global del 75%. Se añadieron 18 pruebas de estas funciones.
Se comprobaron en navegador los perfiles, publicación de una escena de prueba,
fichas, calendario, marcador manual, inicio/fin de juegos, menú integrado y ancho
móvil. El entorno de revisión está en `tools/qa_creator.py` y usa datos desechables.

El navegador de revisión todavía emitió intermitentemente el aviso de
MutationObserver registrado en la revisión anterior; no se obtuvo una traza de
la aplicación que confirmara su origen. Las funciones recorridas respondieron.
No se certifican audio audible, composición dentro de OBS/LIVE Studio ni
recepción de eventos reales de TikTok mediante las pruebas simuladas.
