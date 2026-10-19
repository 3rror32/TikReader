# Recuperación completa de TikReader

1. En Ajustes, guarda un perfil con la configuración actual y pulsa **Exportar perfiles**. Este archivo recupera los ajustes del navegador, incluida la voz seleccionada.
2. Cierra TikReader y ejecuta **tools/Respaldar o recuperar datos.cmd**. Elige crear respaldo y una ruta ZIP nueva.
3. Para recuperar, cierra TikReader, ejecuta el mismo archivo, elige recuperar y selecciona el ZIP. Escribe RESTAURAR TODO. La aplicación valida los archivos y crea un respaldo previo antes de reemplazar los datos existentes.
4. Abre TikReader, importa los perfiles exportados y carga el perfil deseado. Revisa las reglas y vuelve a autorizar las integraciones.

El ZIP incluye la base SQLite completa (historial, puntos, deduplicación, metas, contadores y ajustes), sonidos, videos, imágenes de alertas y modelos de voz instalados en assets/voice_models. La restauración también sirve en una instalación nueva. Los archivos adicionales que no aparecen en el respaldo se conservan; no se utilizan si la configuración recuperada no los referencia.

El código se respalda por separado con `py -3 app/maintenance.py backup`. El motor y entorno RVC se reinstalan con el instalador existente; el respaldo de datos incluye los modelos, no el entorno de ejecución. Las credenciales de Spotify y RCON requieren autorización nueva. La importación de historial desde la interfaz sigue combinando solo registros, sin reemplazar ajustes ni puntos.

También puedes usar `py -3 app/data_recovery.py backup respaldo.zip` y `py -3 app/data_recovery.py restore respaldo.zip`.

Antes de recuperar se revisan el esquema SQLite y su versión original, los ajustes necesarios para iniciar, los miembros del ZIP y sus checksums. Se admiten las versiones de esquema 1 y 2 con las columnas compatibles; una versión futura o un ajuste inválido detiene la recuperación sin reemplazar la base ni los medios. Los ajustes JSON desconocidos compatibles se conservan; no se corrigen ni recortan silenciosamente.

La comprobación de espacio suma, por unidad, el contenido sin comprimir, la preparación temporal, las copias para deshacer cambios, la base SQLite y el respaldo de seguridad previo. También incluye la unidad de modelos de voz si está separada y una reserva de **64 MB por unidad**. Se vuelve a comprobar antes de reemplazar archivos; otra aplicación puede consumir espacio después, por lo que esta revisión no garantiza disponibilidad permanente.

Un respaldo nuevo se escribe primero en un archivo parcial único junto al destino. Se verifican otra vez el manifest, los checksums y la base antes de publicarlo. Si el destino ya existe o aparece mientras se crea la copia, se conserva y la operación falla: nunca se sobrescribe. Un fallo elimina únicamente los parciales creados por esa operación; el respaldo de seguridad previo se conserva si falla la recuperación.

Los nuevos contadores quedan asociados a la sesión y aparecen en el resumen exportado. Reiniciar o abrir otro LIVE no borra los totales históricos; una sesión nueva comienza en cero. No se pueden reconstruir eventos que versiones anteriores nunca guardaron.
