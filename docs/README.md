# TikReader

Consulta [ESTRUCTURA.md](ESTRUCTURA.md) para localizar el código, los recursos y las herramientas.

Consulta [Estudio y comunidad](ESTUDIO_Y_COMUNIDAD.md) para el editor de escenas,
analítica, batallas, calendario, perfiles y nuevos juegos del chat.

Panel local para leer y administrar comentarios, regalos, participantes y elementos de producción de TikTok Live.

También puede reunir en la misma cabina los chats de **YouTube Live** y **Twitch**.
Abre **Conectar también YouTube o Twitch** debajo de la conexión principal. Cada
comentario conserva su plataforma y utiliza los mismos filtros, voz, puntos,
juegos, automatizaciones e historial. Las claves externas permanecen solo en
memoria hasta desconectar o cerrar TikReader.

## Inicio rápido

1. Ejecuta `tools/Instalar TikReader.cmd` una sola vez.
2. Ejecuta `Iniciar TikReader.cmd`.
3. Abre `http://127.0.0.1:5000` si el navegador no se abre automáticamente.

La interfaz inicia en **Básico**: una ruta de tres pasos para indicar la cuenta,
probar la voz y preparar los overlays. Integraciones externas, colas, audiencia y
diagnósticos avanzados permanecen fuera de esa ruta; cambia a **Avanzado** cuando
necesites operarlos.

El instalador crea un acceso directo **TikReader** en el escritorio con el icono TR. Si ya tienes el programa instalado, ejecuta `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\create_shortcut.ps1` desde esta carpeta para crear el acceso directo sin reinstalar dependencias. Los iconos del navegador, de Windows y de instalación web están en `assets/icons/`.

Por seguridad, el servidor escucha únicamente en este equipo. Para habilitar deliberadamente el panel remoto en la red local, define `TIKREADER_LAN=1` antes de iniciar. Los controles completos siguen restringidos al equipo local; el moderador remoto requiere una clave temporal.

Al habilitar la red local, TikReader añade una clave de solo lectura a las URLs
de overlays que copia desde el panel. Vuelve a copiar las URLs después de esta
actualización: las direcciones antiguas sin clave ya no abren overlays desde otro
equipo. La clave no permite cambiar ajustes ni controlar la transmisión.

En **Centro de control** puedes revisar, antes de salir al aire, el espacio libre,
el historial, los overlays, el motor de TikTok y los componentes opcionales. La
sección **Componentes locales** muestra cuánto ocupa cada motor y permite retirar
Kokoro o RVC con una confirmación escrita; el historial y los modelos personales
no se eliminan desde esa pantalla.

Variables disponibles: `TIKREADER_PORT`, `TIKREADER_LAN` y `TIKREADER_LOG_LEVEL`.

## Idiomas de la interfaz

El selector **Idioma**, en la cabecera, permite cambiar entre **Español (Latinoamérica)** (`es-419`, predeterminado), **English** y **Français** sin recargar. La elección se conserva en este navegador y se sincroniza entre pestañas del mismo origen. El panel de moderación también incluye el selector. Si el almacenamiento no está disponible, el cambio funciona durante la visita actual.

Los catálogos, iconos, estilos y tipografías se sirven localmente, sin Google
Fonts ni servicios de traducción externos. La interfaz usa las tipografías del
sistema y continúa funcionando sin Internet; la conexión solo es necesaria para
las plataformas en vivo o para instalar componentes opcionales. El idioma de la
interfaz no cambia los comentarios recibidos ni el idioma configurado para la
lectura o traducción del chat. Los mensajes sin traducción disponible conservan
su texto original.

Para ampliar las traducciones, agrega una fila `texto original|inglés|francés` en `web/static/translations.js`. `web/static/i18n.js` adapta los textos y atributos de la interfaz existente después de su inicialización, conserva los valores de las opciones y observa los controles dinámicos. Usa `translate="no"` para contenido de usuarios; no uses etiquetas traducidas como identificadores de acciones. Los mensajes nuevos con parámetros pueden usar `window.I18n.t('Texto {count}', {count: 2})` y actualizarse con el evento `tikreader:localechange`.

Pruebas de internacionalización: `node --test tests/test_i18n.cjs`.

## Validación

```powershell
python tools/check_changes.py
```

El comando ejecuta las pruebas Python, las pruebas del navegador, la compilación
TypeScript/Vite, Ruff, cobertura y la comprobación del instalador. La aplicación conserva registros
técnicos rotativos durante 30 días en `data/logs`; la salida redirigida del proceso
se limita a 2 MB por archivo con cuatro copias. El tráfico HTTP normal no se
registra línea por línea y los registros no deben contener comentarios ni nombres
de participantes.

Para habilitar cobertura, Ruff y el muestreo opcional de memoria:

```powershell
python -m pip install -r requirements-dev.txt
```

Antes de una transmisión ejecuta `python app/launcher.py --check`. Para una prueba prolongada de cuatro horas usa `python tools/soak_test.py --seconds 14400 --pid PID`; el reporte se guarda en `data/diagnostics`. La comprobación de audio, el programa de streaming y red física está en [VALIDACION_FISICA.md](VALIDACION_FISICA.md).

Las voces RVC funcionan en un entorno aislado y consumen más GPU/CPU. Los modelos se guardan en `assets/voice_models`; instala el motor oficial con `python tools/setup_rvc.py` y reinicia TikReader. Usa solamente modelos que tengas autorización para ejecutar.

Consulta [INSTRUCCIONES.md](INSTRUCCIONES.md) para operación, el programa de streaming, moderación y recuperación.

El chat y la lista de participantes muestran las insignias que TikTok proporcione; si no llegan datos, no se inventan niveles. El botón «👋 Saludar» reproduce un saludo por voz local usando los controles de Voz (incluidas pausas y silencio de emergencia). No publica mensajes en TikTok; para que se escuche en el LIVE, el audio del panel debe estar incluido en tu transmisión.
