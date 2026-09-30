# Organización de TikReader

Abre **Iniciar TikReader.cmd** desde la raíz para iniciar el programa con doble clic.
Los comandos de esta guía se ejecutan desde la raíz del proyecto.

```text
TikReader/
├── Iniciar TikReader.cmd
├── app/                 Código Python del programa y recuperación
├── assets/
│   ├── voice_models/    Modelos de voz instalados
│   ├── sprites/         Personajes y animaciones de Stream Buddies
│   └── icons/           Iconos del programa
├── web/
│   ├── templates/       Páginas HTML
│   └── static/          JavaScript, CSS y recursos de la interfaz
├── data/                Historial, configuración, medios y respaldos
│   ├── logs/            Registros del programa
│   ├── diagnostics/     Diagnósticos de ejecución
│   └── rvc/             Motor RVC y su entorno Python instalado
├── runtime/             Caché, temporales y resultados de pruebas
├── tools/               Instalación, diagnósticos y herramientas de desarrollo
├── tests/               Pruebas Python y JavaScript
└── docs/                Manuales, informes y capturas
```

El servidor principal coordina el estado y la conexión en vivo. Sus superficies
HTTP están separadas por responsabilidad:

- `app/core_routes.py`: conexión y operaciones principales.
- `app/system_routes.py`: salud, apagado y estado del sistema.
- `app/history_routes.py`: historial, sesiones y respaldos.
- `app/widget_routes.py`: overlays y configuración de widgets.
- `app/studio_routes.py`: estado de producción y diagnóstico exportable.
- `app/diagnostics_routes.py`: acceso local a los registros.

La experiencia Básica se mantiene aislada en `web/static/basic_mode.js` y
`web/static/basic_mode.css`, para que la cabina avanzada pueda evolucionar sin
volver a cargar la ruta de inicio con controles especializados.

`requirements.txt`, `requirements-dev.txt` y `pyproject.toml` permanecen en la raíz
para la instalación y las herramientas de Python. No quedan archivos `.py` sueltos.

El entorno instalado de RVC conserva `data/rvc`: contiene rutas de instalación
que no deben cambiar mediante un traslado de carpetas.

## Acciones habituales

- Instalar: `tools/Instalar TikReader.cmd`.
- Crear el acceso directo: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/create_shortcut.ps1`.
- Diagnosticar el inicio: `python app/launcher.py --check`.
- Ejecutar las pruebas, Ruff y cobertura: `python tools/check_changes.py`.
- Instalar el motor de voz: `python tools/setup_rvc.py`.
- Respaldar o recuperar datos: `tools/Respaldar o recuperar datos.cmd`.
- Actualizar código: `tools/Actualizar o recuperar TikReader.cmd`.

Las direcciones `/static/...` del navegador y las fuentes de OBS se mantienen.
El servidor resuelve los iconos y sprites desde `assets` sin exponer los modelos de voz.

Los respaldos de datos conservan su formato: los modelos del ZIP se restauran
ahora en `assets/voice_models`. Los paquetes de **código** anteriores a esta
organización no son compatibles y se rechazan para evitar romper las rutas.
Los respaldos antiguos se conservan en `data/code-backups`.

Las cachés y temporales anteriores se conservaron dentro de `runtime`.

## Memoria de voz RVC

Cambiar la fuente de voz o el modelo local libera la precarga anterior. Guardar
la voz también cancela las lecturas pendientes de la selección anterior y
desactiva la precarga. Para mantener preparada la nueva voz, activa nuevamente
«Mantener voz preparada en GPU» después de guardarla.

Si hay una conversión en curso, termina antes de liberar sus recursos. Los archivos
del modelo se conservan. El estado confirma cuándo RVC quedó liberado y muestra
un error si el servidor no puede confirmar el cambio.

Al detener el servidor se cierra el proceso RVC. Cada proceso de conversión
también vigila al servidor para salir si este se termina de forma forzada.
Cerrar solamente el navegador o el lanzador no detiene el servidor.
