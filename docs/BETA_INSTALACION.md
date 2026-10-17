# TikReader 1.0.0.9 Beta · instalación

Versión en preparación: el instalador 1.0.0.9 todavía debe construirse y validarse. El paquete local anterior es 1.0.0.8.

## Para instalar

1. Ejecuta `TikReader-1.0.0.9-Beta-Setup.exe` en Windows 10 u 11 de 64 bits.
2. Si tienes una copia anterior, ciérrala y selecciona su carpeta cuando el instalador ofrezca importar datos. Puedes dejar esa opción vacía.
3. Abre TikReader desde el menú Inicio. Se mostrará su ventana nativa; no se requiere instalar Python, abrir un navegador, usar una consola ni configurar variables.

La instalación incluye Python 3.13.15 aislado, Qt/PySide6, el motor visual Qt WebEngine y las demás dependencias. Todos los menús se muestran dentro de la ventana de TikReader, sin abrir ni requerir Chrome, Edge o Firefox. La conexión a un LIVE sí requiere internet y el servicio local conserva las direcciones usadas por las fuentes de navegador de OBS.

## Datos y actualizaciones

El programa se instala en `%LOCALAPPDATA%\Programs\TikReader`. El historial, los ajustes del equipo, medios, registros y voces se guardan en `%LOCALAPPDATA%\TikReader`.

Ejecuta el nuevo instalador para actualizar. Cierra primero TikReader desde **Acerca de → Cerrar TikReader**. Tanto la actualización como la desinstalación conservan los datos personales.

La importación inicial copia historial, ajustes guardados en la base, medios y modelos personalizados desde una copia anterior, sin borrar el original. Se rechaza si ya existen datos de destino. Los entornos de Python antiguos no se copian: no son portables. Descarga Kokoro de nuevo desde la versión instalada. Los perfiles que solo existan en otro navegador deben exportarse desde ese navegador e importarse en la nueva instalación.

El código fuente continúa usando su carpeta `data` por compatibilidad. Esto permite preparar una distribución sin mover los archivos de una sesión de desarrollo. `TIKREADER_DATA_DIR` permite elegir una carpeta independiente para pruebas o despliegues administrados.

## Voces

- **Instalación básica:** voces disponibles en Windows/navegador. Se seleccionan y prueban desde **Voz del chat**. La disponibilidad e idioma dependen del equipo.
- **Kokoro opcional:** **Ajustes y apariencia → Datos y voces adicionales → Descargar e instalar voces**. Son 353.746.785 bytes de modelos (354 MB decimales), más el motor y sus dependencias. Reserva al menos 2 GB libres. La instalación valida los modelos por SHA-256 y comprueba una síntesis antes de informar que terminó. Permite reintentar descargas incompletas. La generación posterior funciona sin red.
- **Subtítulos del micrófono:** Vosk y el modelo pequeño de español están incluidos. No requieren una descarga ni envían audio a servicios externos.
- **RVC personalizado:** los modelos personales no se distribuyen. La importación inicial puede conservarlos, pero el motor RVC/CUDA todavía requiere preparación aparte y una GPU compatible. Esta beta no ofrece instalación automática de RVC. No se presenta como parte de la instalación básica ni de Kokoro.

## Ajustes y diagnóstico

Las preferencias habituales se cambian desde la interfaz. Apariencia, distribución, perfiles y ajustes de voz se guardan también en la base de datos del equipo. El navegador mantiene su copia y recupera la del equipo cuando no tiene ajustes propios.

El instalador crea `.env` en la carpeta de datos únicamente si no existe. Es para puerto, modo de red y diagnóstico interno; no necesita edición para el uso habitual. No incluye claves personales.

**Acerca de → Exportar diagnóstico** descarga un JSON con versión, plataforma, estado, contadores y códigos recientes de error. Excluye nombres, comentarios, perfiles, claves, rutas y registros en bruto. Los registros diarios y respaldos completos son otros archivos y pueden contener información privada.

## Construcción y validación

El desarrollador ejecuta `tools/build_release.py`, seguido del compilador Inno Setup con `packaging/TikReader.iss`. El archivo `release/payload-sha256.json` registra el contenido del paquete. Python se descarga de Python.org y se verifica contra su SHA-256 publicado; las dependencias proceden de PyPI. Las licencias de dependencias se conservan en sus paquetes y las de las voces en `docs/licenses`.

`tools/validate_release.py` prueba inicio con Python incluido, almacenamiento externo, cierre y reapertura. `tools/qa_release.cjs` prueba la interfaz con red externa bloqueada y tamaños de escritorio/móvil. Estas verificaciones usan el equipo de desarrollo: **no equivalen a una computadora limpia**.

Para Windows limpio, abre el archivo `.wsb` generado en `release` si Windows Sandbox está disponible, o usa una máquina virtual/equipo separado. No se habilita ni modifica Windows Sandbox automáticamente.

Antes de distribuir públicamente, consultar el registro archivado [`VALIDACION_BETA_LIMPIA.md`](../archivado/documentos/VALIDACION_BETA_LIMPIA.md). El instalador de esta preparación no tiene firma digital del autor.
