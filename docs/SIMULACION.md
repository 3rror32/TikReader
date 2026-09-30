# Modo simulación

Disponible en el menú **Avanzados → Modo simulación**. Si el menú está en modo básico, cambia **Configuración → Ajustes y perfiles → Funciones visibles** a **Avanzado**.

1. Desconecta el LIVE y activa la simulación. La franja **MODO SIMULACIÓN** permanece en todos los apartados y vuelve a aparecer al recargar. El servidor impide conectar TikTok mientras el modo está activo.
2. Revisa el perfil de juegos y sus acciones guardadas. Se respetan las reglas activadas, autorización de teclas, ventana destino, primer/segundo plano, cantidad, intervalos y límites del LIVE. Las hotkeys actuales responden a regalos; los comentarios pasan por las automatizaciones de comentarios existentes.
3. Envía un comentario o un regalo. Puedes escribir el nombre exacto usado por tu regla aunque no tengas catálogo. El catálogo, cuando existe, aporta imagen y diamantes.
4. Elige una racha acumulativa de N regalos o N envíos independientes de un regalo. Configura cantidad, intervalo y espera inicial. Para un perfil de primer plano, cambia al juego durante la espera y mantenlo al frente.
5. Observa los overlays en sus URLs o ventanas habituales. Usa **Usar audio en esta pestaña** para reproducir los sonidos. La lectura automática y los avisos conservan los interruptores del LIVE.
6. Consulta el recorrido y el registro de hotkeys. Una regla coincidente no garantiza ejecución: la ventana puede no estar disponible, puede faltar autorización o puede existir una pausa. «Hotkey pulsada» confirma el envío al sistema, no la reacción del juego.
7. **Detener acciones** cancela los envíos pendientes y pausa la emisión. **Reanudar en escena Charla** permite seguir probando sin reiniciar los límites. **Desactivar simulación** termina esta sesión y deja el LIVE desconectado y la emisión pausada.

La sesión del historial se identifica como `MODO_SIMULACION`. Los efectos son reales: se actualizan temporizadores, puntos y overlays y se ejecutan los conectores autorizados igual que durante el LIVE. Detener no revierte acciones ya ejecutadas. No se envían comentarios ni regalos a TikTok.

## Validación

`python -m unittest discover -s tests -p test_simulation.py -v` con `PYTHONPATH=app` comprueba el flujo compartido, rachas de 9/10/15, duplicados de cierre, envíos separados, límites, overlays, contadores, cancelación y bloqueo de conexión. La pulsación nativa está sustituida en estas pruebas para no controlar programas del operador.
