# Migración de TikReader a ventana nativa

## Reglas de compatibilidad

- La base `history.sqlite3`, las voces, los medios y `.env` permanecen en la carpeta de datos existente.
- El instalador nunca sobrescribe un `.env` existente.
- Las rutas `/widget` y `/broadcast` permanecen disponibles para fuentes de navegador de OBS.
- La interfaz web no se elimina hasta que su último control tenga un equivalente nativo comprobado.
- Cada fase debe pasar las pruebas de servidor, almacenamiento, actualización y cierre.

## Disponible en la ventana nativa

- Estudio completo integrado con todos los menús, submenús y controles existentes.
- Inicio y detención de una conexión LIVE.
- Estado de conexión y reconexión.
- Comentarios, regalos y contadores en tiempo real.
- Lista de sesiones y creación de respaldos del historial.
- Copia de las principales URLs para OBS.
- Edición validada de puerto, acceso LAN y nivel de registro en `.env`.
- Acceso a la carpeta de datos y cierre completo del servicio.

## Compatibilidad completa

Voces, subtítulos, estudios de overlays, juegos, puntos, hotkeys, Spotify, Minecraft, producción, moderación, simulación, diagnósticos y creador se cargan dentro de **Estudio completo**. Qt WebEngine forma parte del runtime de TikReader: no abre ni requiere Chrome, Edge o Firefox. El estudio ocupa toda la ventana y muestra una sola barra lateral, la que contiene todos los menús y submenús del programa.

## Empaquetado

La versión `1.0.0.4` agrega `PySide6-Essentials` y `PySide6-Addons` al runtime incluido. El segundo paquete incorpora Qt WebEngine. El constructor invalida su caché de dependencias cuando cambian `requirements.txt`, Python o los archivos de bloqueo, evitando producir un instalador incompleto.
