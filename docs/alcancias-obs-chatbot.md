# Alcancías, diagnóstico, OBS y chatbot

En Ajustes y perfiles → Funciones visibles, selecciona Avanzado para ver las integraciones.

## Alcancías

En Overlays → Galería de overlays → Escena → Caída de puntos:

- Los regalos y el marcador se guardan al depositar. Se recuperan al recargar, cerrar el overlay o reiniciar TikReader.
- Se conservan hasta 220 regalos recientes; la cantidad que cabe depende del área y tamaño elegidos. El contador conserva el total. Las posiciones se conservan en el navegador mientras la figura y el contorno coincidan; otro navegador reconstruye el apilado con los mismos regalos.
- Vaciar alcancía borra el llenado guardado y reinicia el marcador, conservando la configuración de figuras.
- Abre Ajustar área de llenado y entrada y pulsa Editar sobre la alcancía. Arrastra puntos verdes para ajustar el contorno; mueve el amarillo para cambiar la entrada. Flechas: 0.25%; Mayús+flechas: 1%. Se pueden añadir o quitar puntos (6–64).
- Guardar cavidad publica solo el contorno de esa figura. Cancelar descarta el borrador. Restaurar contorno original vuelve a la geometría incluida. Los contornos cruzados se rechazan.
- La aceleración inicial y desaceleración final siguen durando 0.5 segundos cada una, independientemente de la duración de caída.

## Diagnóstico

Configuración → Diagnóstico de eventos muestra los últimos 500 registros en memoria, con búsqueda y filtros: regla, evento, espera, ejecución, rechazo, duplicado, pausa, intervalo o cola. Se actualiza mientras la página está visible. Una confirmación externa solo aparece si OBS confirmó su respuesta; aceptar una regla no equivale a terminar sus acciones.

## OBS directo

Overlays → Control de OBS se conecta a WebSocket v5 en esta computadora (127.0.0.1). En OBS, activa Herramientas → Ajustes del servidor WebSocket y copia el puerto y contraseña al panel. Guarda y consulta escenas; esta consulta no cambia la emisión. Activa Permitir cambios desde TikReader para cambiar escenas o mostrar/ocultar fuentes.

Las automatizaciones tienen acciones Cambiar escena OBS, Mostrar fuente OBS y Ocultar fuente OBS. El valor de una escena es su nombre exacto. Para fuentes, usa `Escena|Fuente`. Los elementos dentro de grupos deben dirigirse usando el nombre del grupo como escena. La conexión se realiza por acción, sin reintentos automáticos. Las acciones en cola caducan después de 10 segundos y respetan la pausa de emisión.

La contraseña y la activación se conservan solo durante la ejecución. Tras reiniciar, configura y activa otra vez. No se inicia ni detiene una transmisión desde estos controles.

## Chatbot

Moderación → Chatbot admite respuestas a comandos exactos (como `!hola`) y un recordatorio periódico opcional. Usa `{usuario}` en una respuesta. Guarda y prueba sin publicar antes de activar.

El envío requiere una clave API de Eulerstream con Premium Routes y un token de acceso OAuth con permiso para enviar chat. [Autorización de Eulerstream](https://www.eulerstream.com/docs/oauth). TikReader envía el texto y la autorización a `https://api.eulerstream.com/webcast/chat`; el servicio lo publica en la cuenta autorizada. El token puede caducar: reemplázalo en este panel. No se implementa renovación automática de OAuth.

Las credenciales solo permanecen en memoria; nunca se incluyen en archivos de configuración, respuestas del panel o registros. Tras reiniciar debes introducirlas de nuevo. No se envía nada al guardar con la activación desmarcada. Hay un mínimo de 5 segundos entre mensajes, intervalos por comando, deduplicación, detección de ecos y cancelación por pausa o cambio de LIVE. El envío fallido no se reintenta para evitar duplicados. La actividad indica confirmaciones o errores.

Validación: pruebas automáticas de restauración en SQLite, contornos inválidos, protocolo OBS, pausa, deduplicación, intervalos y exclusión de credenciales. La verificación con OBS real y la publicación real requieren las conexiones del usuario.
