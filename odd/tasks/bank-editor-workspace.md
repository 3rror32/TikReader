# Alcancías: editor unificado y fiable

## Objective

Corregir la experiencia de `Overlays > Herramientas > Alcancías` para que exista una sola vista previa editable, con acciones pertinentes, puntos de edición visibles, proporción estable y comportamiento verificable.

## Problem and why

La interfaz actual mantiene dos representaciones de la alcancía, muestra controles de texto y color que no afectan esta herramienta, permite que reglas de formato pisen la proporción del editor y no refleja en vivo todos los cambios de los puntos editables. Esto hace que la edición parezca rota y que el resultado guardado no coincida con lo mostrado.

## Authorized scope

- Unificar la experiencia alrededor de la vista previa del iframe de Overlays.
- Mostrar solo controles y acciones aplicables a Alcancías.
- Hacer perceptibles y operables los puntos de contorno y entrada.
- Mantener una relación de aspecto coherente en escritorio y móvil.
- Corregir previsualización, selección, guardado, cancelación y recarga.
- Añadir o ajustar pruebas enfocadas al flujo.

## Constraints

- Reutilizar el backend y el formato de persistencia existentes.
- No alterar otros juegos, overlays ni herramientas de texto/color.
- Mantener navegación por teclado, foco visible y mensajes de estado.
- Mantener código y copy técnico en el idioma existente del producto.

## Delivery

- Strategy: `ask-on-risk`.
- Forecast: aproximadamente 260 líneas authored (adiciones + eliminaciones; archivos generados excluidos).
- Current authored count: 49 líneas authored de implementación y pruebas; 113 al incluir el documento de tarea nuevo en Git.
- Feature branch: `codex/operator-ux-trust-polish` (ya activa; no es la rama por defecto).
- Engram mirror `odd/bank-editor-workspace/tasks`: pendiente; el proveedor de memoria no está disponible en esta sesión.

## Tasks

- [x] **BANK-01 — Unificar y reparar el editor de Alcancías**
  - Route: delegated direct.
  - Trigger evidence: lectura preparatoria y cambios no triviales en múltiples archivos de interfaz y pruebas.
  - Outcome: una sola escena editable con todas las acciones relevantes; controles ajenos ocultos; handles visibles; punto de entrada actualizado en vivo; proporción coherente.
  - Acceptance criteria:
    - Solo una vista previa de Alcancías es visible en el editor.
    - Las acciones de editar, añadir, eliminar, guardar y cancelar están disponibles junto a esa vista.
    - Los controles de texto, color y tipografía no aparecen en Alcancías.
    - Los puntos editables son visibles, seleccionables con puntero y teclado, y reflejan su selección inmediatamente.
    - La vista conserva su proporción prevista en escritorio y móvil sin reglas contradictorias.
    - Cambiar el punto de entrada de modelos integrados actualiza la vista antes de guardar.
    - Guardar, cancelar y recargar mantienen el comportamiento esperado.
  - Verification:
    - `node --test tests/test_bank_editor.cjs tests/test_overlay_gallery.cjs`
    - `npm run check:overlays`
    - Validación visual y funcional del flujo en navegador, escritorio y viewport móvil.
  - Evidence:
    - RED: la nueva prueba del punto integrado observó `46%` en vez de `62%`; la prueba estructural también detectó que el formulario general seguía visible.
    - GREEN: `node --test tests/test_bank_editor.cjs tests/test_overlay_gallery.cjs` pasó con 39/39 pruebas; `npm run check:overlays` terminó con código 0 (`tsc --noEmit`).
    - El fallo previo del test de navegación (`window is not defined`) se corrigió completando el contexto del test; no requería cambiar comportamiento de producto.
    - `git diff --check` pasó. Authored count: 113 líneas (adiciones + eliminaciones; sin generados).
    - La primera validación visual quedó pendiente por entorno; la verificación independiente posterior la sustituyó con Chromium, plantilla y scripts reales, y respuestas locales sintéticas.
  - Work-unit commit: `fix(overlays): unify piggy bank editor` (identidad incluida en el cierre del worker).
  - Native review assessment: no disponible; `gentle-ai` no está instalado o accesible en esta sesión. Se aplicó verificación independiente de riesgo alto y comprobación puntual del orquestador.
  - Corrección acotada posterior al commit `534c76e`:
    - Hallazgos independientes: los modelos integrados reabrían desde `entry_point` en vez de `shape.slot`; el redraw del SVG perdía el foco del handle; y el CSS del padre no alcanzaba el SVG dentro del iframe.
    - RED: se añadieron regresiones para reabrir `[62,32]` frente a `entry_point` obsoleto `[50,16]`, conservar foco y permitir ArrowRight tras pointerup, y comprobar los atributos SVG de foco; las tres fallaron antes del arreglo.
    - GREEN: hidratación integrada desde `draft.slot` y custom desde `entry_point`; pointerdown enfoca el handle y el redraw restaura el índice enfocado; atributos SVG aplican énfasis y foco dentro del iframe. Se eliminaron reglas CSS del padre que no podían alcanzar los handles.
    - `node --test tests/test_bank_editor.cjs tests/test_overlay_gallery.cjs`: 41/41 pasaron.
    - `npm run check:overlays`: pasó (`tsc --noEmit`, código 0).
    - `git diff --check 534c76e HEAD`: pasó tras crear `0d43cfe`; también pasó la comprobación staged antes del commit.
    - Authored count de esta corrección: 70 líneas (adiciones + eliminaciones; sin archivos generados).
    - Nuevo work-unit commit: `0d43cfe fix(overlays): preserve bank editor state` (sin amend).
  - Corrección acotada posterior al commit `9475acf`:
    - Hallazgos de integración: `AnimationControls.select('')` reabría el formulario genérico después de mostrar Alcancías; el shell reparentaba el registro `point-drop` a `config-content`, haciendo visible una segunda arena fuera del iframe.
    - RED: la prueba de integración ejecuta el registro del template, `live_games` y `OverlayGallery.registerGameControls` antes de conectar el callback real de `shell.js`; corre también los selectores reales en su orden fuente. Fallaba con controles reparentados, formulario visible y dos escenas visibles.
    - GREEN: `live_games.js` deja el registro `point-drop` en propiedad de OverlayGallery; esta reaplica su visibilidad después de selectores auxiliares y oculta solo la arena de operador mientras `point-drop` está activo, restaurándola al cambiar de overlay. Animaciones y otros overlays conservan el comportamiento del formulario.
    - `node --test tests/test_bank_editor.cjs tests/test_overlay_gallery.cjs`: 42/42 pasaron.
    - `npm run check:overlays`: pasó (`tsc --noEmit`, código 0).
    - `git diff --check 9475acf HEAD`: pasó tras crear `d565914`; también pasó la comprobación staged antes del commit.
    - Authored count: 70 líneas (adiciones + eliminaciones; sin archivos generados).
    - Work-unit commit: `d565914 fix(overlays): keep bank tools in workspace` (sin amend).
  - Verificación independiente final:
    - Chromium confirmó `overlay-style-form.hidden=true`, la arena local oculta y exactamente un iframe visible en Alcancías.
    - El panel permaneció dentro de OverlayGallery con siete acciones visibles y habilitadas.
    - Los 26 handles conservaron foco tras clic; flechas, estilo blanco de 2 px, sombra, actualización en vivo y cancelación funcionaron dentro del iframe.
    - La entrada integrada `[62,32]` se reabrió intacta.
    - Relación 4:5 observada en escritorio (`439.734×549.656`) y móvil (`290×362.5`), sin desbordamiento.
    - Navegar entre webcam, temporizador, rueda y Alcancías mantuvo visibles solo los formularios aplicables y no produjo errores JavaScript.
    - `node --test tests/test_bank_editor.cjs tests/test_overlay_gallery.cjs`: 42/42 pasaron; `npm run check:overlays` y `git diff --check 534c76e 89f3957` pasaron.
    - Limitación: la persistencia se ejercitó en navegador real con respuestas locales sintéticas, no contra un backend o transmisión en vivo.

## Progress and next step

BANK-01 completada. La verificación automatizada y la inspección independiente en Chromium confirmaron una sola escena, todas las acciones pertinentes, edición accesible, persistencia local coherente y proporción 4:5 en escritorio y móvil. La evaluación nativa no estuvo disponible; no quedan cambios locales ni verificaciones aplicables pendientes salvo una prueba opcional contra backend/transmisión reales.
