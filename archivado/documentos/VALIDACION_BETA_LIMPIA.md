# Validación en Windows limpio · TikReader Beta

Estado: pendiente de ejecución en una máquina limpia. Las pruebas aisladas en el equipo de desarrollo se registran por separado en `release/validation-report.json`.

Equipo/VM: ______  Windows y arquitectura: ______  Fecha: ______  Probó: ______

| Prueba | Resultado esperado | Resultado real |
|---|---|---|
| Instalar sin Python ni Node | Instalación completa sin consola ni configuración técnica | Pendiente |
| Abrir desde Inicio | Una sola instancia; interfaz disponible | Pendiente |
| Abrir dos veces | Reutiliza el servidor; no duplica la sesión | Pendiente |
| Conectar un LIVE confirmado activo | Estado conectado y eventos recibidos | Pendiente |
| Leer un comentario con voz del equipo | Audio audible tras habilitar la lectura | Pendiente |
| Descargar Kokoro | Progreso, tamaño visible y verificación completa | Pendiente |
| Probar Kokoro sin internet | Audio local generado sin descarga adicional | Pendiente |
| Guardar apariencia/perfil/voz | Se conserva al reabrir y en un navegador nuevo | Pendiente |
| Cerrar desde Acerca de | Servidor y motores terminan; puerto disponible | Pendiente |
| Reabrir | Historial, ajustes y modelos conservados | Pendiente |
| Reinstalar/actualizar con el programa cerrado | Conserva datos y configuración `.env` | Pendiente |
| Intentar actualizar mientras está abierto | Instalador solicita cerrar; no fuerza procesos | Pendiente |
| Importar copia anterior | Copia datos a destino vacío y conserva el original | Pendiente |
| Exportar diagnóstico | JSON sin nombre de Windows, usuario TikTok, comentarios o claves | Pendiente |
| Desinstalar | Quita programa/accesos directos, conserva datos personales | Pendiente |

Si una prueba falla, guardar el diagnóstico compartible y describir los pasos; no adjuntar la base de datos ni registros completos por defecto.

La reinstalación de la misma beta comprueba conservación durante reparación. Una futura actualización de esquema requiere repetir la prueba con la versión anterior real.
