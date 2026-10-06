# TikReader

**TikReader es una cabina local para preparar y operar transmisiones en vivo.** Reúne comentarios y actividad de TikTok Live —y, de forma opcional, YouTube Live y Twitch— con herramientas de voz, moderación, overlays e historial.

> Diseñado para trabajar primero en el equipo local: la conexión de red local es opcional y debe habilitarse deliberadamente.

| A primera vista | Detalle |
|---|---|
| 📡 Fuentes | TikTok Live; YouTube Live y Twitch opcionales |
| 🖥️ Acceso predeterminado | `http://127.0.0.1:5000` en tu equipo |
| 🌐 Idiomas de interfaz | Español (Latinoamérica), English y Français |
| 🔐 Datos externos | Las claves y tokens de YouTube y Twitch se mantienen en memoria |

## Contenido

- [Inicio rápido](#inicio-rápido)
- [Qué puedes hacer](#qué-puedes-hacer)
- [Configuración y privacidad](#configuración-y-privacidad)
- [Desarrollo y validación](#desarrollo-y-validación)
- [Documentación](#documentación)
- [Solución de problemas](#solución-de-problemas)

## 🚀 Inicio rápido

En Windows, desde la carpeta del proyecto:

1. Ejecuta `tools/Instalar TikReader.cmd` una vez. Requiere Python disponible mediante `py -3` y conexión a Internet para crear `.venv` e instalar `requirements.txt`.
2. Ejecuta `Iniciar TikReader.cmd`.
3. Abre `http://127.0.0.1:5000` si la interfaz no aparece automáticamente. Ingresa el usuario de una transmisión activa y pulsa **Conectar**.

El lanzador comprueba dependencias y puede reutilizar un servidor ya activo. No instala dependencias por sí solo. Para revisar requisitos de arranque sin iniciar la interfaz, ejecuta `python app/launcher.py --check`.

## ✨ Qué puedes hacer

- **Leer y organizar el chat:** conectar TikTok Live; añadir YouTube Live o Twitch; aplicar filtros; gestionar voz, preguntas y moderación.
- **Preparar la transmisión:** configurar escenas, overlays, alertas y ventanas de producción para el programa de streaming.
- **Usar funciones interactivas:** puntos y niveles, juegos del chat y conectores locales opcionales, como Minecraft.
- **Consultar y cuidar los datos:** revisar sesiones, crear respaldos y usar herramientas de diagnóstico, operación y recuperación.
- **Trabajar en varios idiomas:** la interfaz ofrece Español (Latinoamérica), English y Français. Esto no traduce los mensajes recibidos.

Consulta la [guía de operación](INSTRUCCIONES.md) para los pasos, límites y detalles de cada función.

## 🔒 Configuración y privacidad

- De forma predeterminada, la interfaz escucha solo en este equipo (`127.0.0.1`) en el puerto `5000`. `TIKREADER_PORT` permite cambiar el puerto; `TIKREADER_LOG_LEVEL` cambia el nivel de registro.
- Para habilitar escucha en la red local, establece `TIKREADER_LAN=1` antes de iniciar. No expongas el panel a Internet: consulta las condiciones del [moderador remoto](INSTRUCCIONES.md#moderador-limitado-y-seguridad). Las claves de acceso por HTTP no están cifradas.
- Las claves y tokens de YouTube y Twitch se mantienen en memoria y no se guardan en la base de datos, respaldos, diagnósticos ni almacenamiento del navegador; tendrás que ingresarlos de nuevo tras reiniciar.
- Los comentarios y regalos se guardan localmente en el historial. Los respaldos pueden incluir nombres y comentarios: protégelos como información privada. Ocultar datos en una vista pública no elimina los originales del historial.
- Las voces y otros componentes opcionales pueden requerir descargas adicionales. Revisa sus [dependencias y licencias](LOCAL_TTS_LICENSES.md) antes de instalarlos.

## 🧪 Desarrollo y validación

Para instalar dependencias de desarrollo, ejecuta `python -m pip install -r requirements-dev.txt`. La comprobación del proyecto es:

```powershell
python tools/check_changes.py
```

También puedes ejecutar una prueba individual del navegador con `node --test tests/test_i18n.cjs`. Para validar hardware, audio y el programa de streaming, sigue la [validación física](VALIDACION_FISICA.md); las pruebas automatizadas no sustituyen esa comprobación.

## 📚 Documentación

| Guía | Para qué sirve |
|---|---|
| [Instrucciones](INSTRUCCIONES.md) | Operación, conexiones, voz, moderación, overlays, historial y herramientas. |
| [Estructura](ESTRUCTURA.md) | Organización del código y recursos. |
| [Estudio y comunidad](ESTUDIO_Y_COMUNIDAD.md) | Escenas, comunidad, batallas, calendario, perfiles y juegos. |
| [Overlays visuales](OVERLAYS_VISUALES.md) | Arquitectura y desarrollo de overlays para OBS. |
| [Modo simulación](SIMULACION.md) | Alcance y validación del modo de simulación. |
| [Recuperación](RECUPERACION.md) | Respaldo y recuperación de datos. |
| [Instalación beta](BETA_INSTALACION.md) | Notas de instalación de la versión beta. |
| [Voces locales](LOCAL_TTS_LICENSES.md) | Motores de voz, dependencias y licencias. |

## 🛠️ Solución de problemas

- **No inicia:** revisa el mensaje de la consola y ejecuta `python app/launcher.py --check` para detectar dependencias faltantes o un puerto ocupado.
- **No conecta o no aparecen mensajes:** verifica que la transmisión esté activa y que el chat esté habilitado. Solo se muestran eventos recibidos durante la conexión; los tiempos de espera también pueden depender de TikTok o la red.
- **No se escucha la voz en la transmisión:** incluye el audio de la ventana/panel de TikReader en la mezcla de audio del programa de streaming y verifica la salida seleccionada.
- **Necesitas recuperar datos:** cierra TikReader y sigue [Recuperación completa](RECUPERACION.md).

Para límites conocidos y diagnósticos adicionales, consulta [Diagnóstico en las instrucciones](INSTRUCCIONES.md#diagnóstico).
