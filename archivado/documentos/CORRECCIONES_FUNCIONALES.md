# Correcciones y verificación

Se corrigieron las pausas y cambios de sesión de RVC, los controles de emergencia
de minijuegos, la restauración de sus ajustes y el fin de giro gestionado por el
servidor. Las reglas admiten `wheel` y `drop`; las fichas de la alcancía son un
marcador visual independiente del saldo persistente de espectadores.

Los objetivos personalizados tienen título, meta y valor guardados en SQLite,
editables en la galería. Las metas de compartidos, seguidores y suscripciones
cuentan notificaciones observadas durante la conexión. Las monedas suman el valor
informado de los regalos observados; no representan dinero ni ingresos.
Los contadores por nombre de regalo acumulan toda la sesión, aunque la lista
visible retire registros después de los primeros 100. Iniciar una nueva sesión
restablece estos contadores; no reconstruyen eventos anteriores a la conexión.

Responder o reabrir preguntas sincroniza los comentarios, la cola preparada y el
historial. El bono de suscripción requiere confirmación observada en la sesión
actual; ya no se arrastra indefinidamente de sesiones anteriores. No se infiere
vigencia de una suscripción a partir de una insignia. La opción de voz por
Internet se retiró del selector hasta que se elija e implemente un proveedor.

## Minecraft

- Recepción TCP fragmentada, validación de autenticación y de respuestas RCON.
- Cancelación de trabajos por sesión, cambio de configuración, pausa, emergencia
  y caducidad. Una solicitud ya enviada al servidor no puede retirarse.
- Guardar comandos sin escribir otra contraseña conserva la contraseña en memoria;
  todo cambio exige autorizar otra vez. Desconectar borra la contraseña.
- «Comprobar conexión sin ejecutar un alias» consulta `list`, sin modificar el mundo.

La prueba automática usa un servidor TCP local simulado y comprueba el intercambio
RCON completo. No equivale a probar un servidor Minecraft real.
En el servidor real inspeccionado, Minecraft estaba sin autorizar, con cero alias
y sin un servicio escuchando en 127.0.0.1:25575. Para comprobarlo físicamente,
inicia un servidor Minecraft Java con RCON, configura sus datos en el panel y usa
«Autorizar y probar RCON». No hace falta comprar ni enviar regalos de TikTok.

## Spotify

La URL de retorno toma el puerto configurado. El panel muestra la URL exacta para
registrarla y ofrece «Comprobar Spotify y dispositivo». Se comprueban autorización
PKCE, cookie de navegador, renovación de token, dispositivo y errores de red. Una
petición que falla permanece pendiente y no se reintenta automáticamente.
Cambiar de sesión descarta las peticiones musicales anteriores.

El diagnóstico requiere también `user-read-playback-state`; las autorizaciones
anteriores deben renovarse para conceder ese permiso. Referencias oficiales:
[URL de retorno](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
y [estado de reproducción](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback).

La cuenta del servidor inspeccionado estaba desconectada. La verificación real
requiere conectar Spotify dentro de TikReader y un dispositivo de reproducción.
Las pruebas automáticas usan respuestas simuladas; no reproducen ni encolan música
en una cuenta real.

## Aplicación de cambios

El servidor real estaba conectado a un LIVE; no se reinició. Cierra y vuelve a
abrir TikReader al terminar la transmisión y recarga sus ventanas y overlays para
cargar juntos el backend y los archivos de interfaz actualizados.

`python tools/check_changes.py` descubre todos los módulos `test_*.py` y `test_*.cjs`,
comprueba sintaxis JavaScript, ejecuta Ruff y mide cobertura cuando está instalado.
`python tools/qa_studio.py` permite probar la interfaz en una base temporal en el puerto
5001 sin conectar TikTok ni enviar teclas reales.
