# Arquitectura de overlays para OBS

Los overlays conservan sus direcciones y ajustes, pero su código visual moderno vive en `frontend/` y se compila con Vite a `web/static/build/`. El instalador sólo distribuye los archivos estáticos resultantes: OBS no necesita Node, npm ni acceso a un CDN durante el live.

## Likes y regalos separados

La ventana de transmisión dispone ahora de dos fuentes dedicadas:

- `http://localhost:5000/overlay/likes`: medidor horizontal de likes, pensado para permanecer fijo.
- `http://localhost:5000/overlay/gifts`: tarjeta de regalo reciente, pensada para aparecer como alerta.

`http://localhost:5000/overlay` se conserva para las escenas existentes. Añade `?preview=1` a cualquiera de las dos nuevas direcciones para comprobar su composición con datos de ejemplo sin usar el LIVE real.

## Estrategia de rendimiento

- `OverlayTransport` mantiene una conexión Socket.IO para reaccionar a comentarios, regalos, estadísticas y cambios de sesión. Las consultas HTTP pasan a ser recuperación cada 5 segundos, no el mecanismo principal cada segundo.
- `OverlayLifecycle` detiene intervalos y renderizadores cuando la fuente queda oculta y libera recursos al cerrar la página.
- CSS Keyframes/Transitions cubren entradas simples y respetan `prefers-reduced-motion`.
- GSAP se descarga de forma diferida sólo cuando un contador, regalo o secuencia compleja necesita una línea de tiempo.
- tsParticles se usa para celebraciones masivas con límite de 30 FPS, densidad fija y vida finita.
- Las monedas se dibujan en Canvas 2D y Matter.js calcula sus colisiones. Así se evita mantener un segundo contexto WebGL para una animación breve.
- Lottie light reproduce la medalla vectorial y se destruye junto con su escena.
- Los efectos tienen límites por tamaño de pantalla; no dependen de la densidad de píxeles completa de monitores 4K.

## Capas

| Capa | Responsabilidad |
| --- | --- |
| `frontend/runtime` | Socket.IO, recuperación HTTP, visibilidad y liberación de recursos |
| `frontend/entries/broadcast.ts` | Ventana principal de transmisión y actualización segura del DOM |
| `frontend/entries/studio.ts` | GSAP, Lottie, tsParticles y Canvas/Matter cargados sólo al necesitarse |
| `frontend/styles/broadcast.css` | Tailwind CSS y tokens visuales del overlay principal |
| `web/static/build` | Salida estática optimizada que consumen Flask y OBS |

## Tecnologías

| Tecnología | Uso |
| --- | --- |
| TypeScript | Contratos de estado, runtime y motores visuales |
| CSS3 + Tailwind CSS | Composición, tokens, accesibilidad y animaciones simples aceleradas |
| GSAP | Líneas de tiempo, entradas y contadores |
| Lottie light | Medalla vectorial de meta cumplida |
| Canvas API + Matter.js | Monedas con física sin un renderizador WebGL permanente |
| tsParticles | Confeti y partículas de bienvenida |
| Socket.IO | Eventos inmediatos con reconexión y respaldo HTTP |
| Vite | División de código, minificación y archivos locales para OBS |

Framer Motion no se incluye porque los overlays no usan React; añadir ambos runtimes incrementaría el peso sin mejorar las secuencias existentes. PixiJS y Motion dejaron de cargarse en las fuentes migradas. Los archivos históricos permanecen temporalmente para compatibilidad con herramientas antiguas, pero las plantillas activas apuntan al nuevo build.

## Desarrollo

```powershell
npm install
npm run check:overlays
npm run build:overlays
```

`npm run dev:overlays` inicia Vite para trabajo frontend. Antes de crear un instalador debe ejecutarse `npm run build:overlays`; el resultado queda dentro de `web/` y el empaquetador existente lo copia sin requerir Node en el equipo destino.

## Comprobaciones recomendadas en OBS

1. Añadir las URLs existentes como fuentes Navegador, con fondo transparente.
2. Activar “Cerrar archivo cuando no esté visible” y probar ocultar/mostrar cada fuente.
3. Simular ráfagas de regalos y likes mientras se observa el uso de GPU de OBS.
4. Probar a 720p, 1080p y una fuente vertical; la cantidad de partículas debe mantenerse acotada.
5. Cortar la conexión unos segundos: Socket.IO debe reconectar y la recuperación HTTP debe completar cualquier hueco.
