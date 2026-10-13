/* Contextual help is shared by pointer and keyboard users. No application actions. */
(() => {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  const descriptions = {
    live: 'Conecta tu cuenta y sigue los comentarios y regalos del directo.',
    voice: 'Elige cómo se leen en voz alta los mensajes del chat.',
    'microphone-captions': 'Convierte lo que dices al micrófono en subtítulos para tu transmisión.',
    'overlay-gallery': 'Elige elementos para tu pantalla y guarda tus favoritos.',
    'overlay-animations': 'Elige animaciones que reaccionan a la actividad de tu comunidad.',
    'overlay-effects': 'Añade ambientes y efectos continuos a tu escena.',
    'overlay-tools': 'Encuentra chat, regalos, rankings y otros elementos para tu transmisión.',
    'overlay-goals': 'Configura metas, cuentas regresivas y objetivos personalizados.',
    'overlay-favorites': 'Abre los overlays que marcaste con una estrella.',
    'overlay-custom': 'Instala tus propios paquetes HTML, configura sus controles y copia su dirección para OBS.',
    'overlay-my-animations': 'Crea y edita tus animaciones personalizadas.',
    questions: 'Prepara y revisa preguntas para responder durante el directo.',
    filters: 'Elige qué comentarios se permiten en la lectura por voz.',
    moderator: 'Da acceso al panel de ayuda a otra persona con una clave temporal.',
    'chat-poll': 'Crea una encuesta para que participe tu audiencia.',
    chatbot: 'Configura respuestas automáticas para el chat.',
    obs: 'Obtén las direcciones de las fuentes para añadirlas a tu programa de streaming.',
    'obs-direct': 'Conecta tu programa de Stream y controla sus escenas desde esta aplicación.',
    production: 'Cambia entre inicio, charla, pausa y despedida; ajusta la privacidad y los anuncios.',
    alerts: 'Prepara los avisos visuales y sonoros de tu transmisión.',
    'creator-scenes': 'Abre el editor visual para diseñar y organizar tus escenas.',
    'custom-voice': 'Elige y personaliza el personaje que lee tus mensajes.',
    spotify: 'Conecta y gestiona la música de Spotify.',
    'sound-library': 'Organiza los sonidos que usarás en el directo.',
    'video-library': 'Organiza videos y abre un panel separado para mostrarlos.',
    'game-hotkeys': 'Asocia eventos del directo con atajos de teclado para tus juegos.',
    minecraft: 'Configura la conexión y las acciones para Minecraft.',
    points: 'Ajusta los puntos y niveles de participación.',
    'creator-games': 'Prepara actividades y juegos para tu audiencia.',
    'creator-battles': 'Gestiona las batallas de tu comunidad.',
    'creator-community': 'Consulta y organiza tu comunidad.',
    'control-center': 'Centro de control: revisa y controla las automatizaciones conectadas a tu directo.',
    interactive: 'Define qué acciones se ejecutan al recibir eventos.',
    streamerbot: 'Conecta las acciones que tengas preparadas en Streamer.bot.',
    simulation: 'Envía eventos de prueba. Pueden ejecutar tus reglas y acciones reales.',
    preflight: 'Comprueba tu configuración antes de empezar a transmitir.',
    diagnostics: 'Revisa el estado de la conexión y sus avisos.',
    'event-diagnostics': 'Consulta los eventos recibidos para entender qué ocurrió.',
    history: 'Consulta sesiones anteriores y sus datos.',
    workspace: 'Cambia la apariencia, distribución y perfiles de la aplicación.',
    'creator-suite': 'Abre en un solo lugar tus escenas, juegos, comunidad, perfiles, calendario y recursos.',
    'platform-integrations': 'Configura las conexiones con YouTube, Twitch y Kick.',
    'creator-profiles': 'Gestiona las configuraciones preparadas del estudio del creador.',
    'creator-calendar': 'Planifica tus directos y sus recordatorios.',
    'creator-library': 'Organiza los recursos de voz y alertas del creador.',
    about: 'Consulta información sobre la aplicación y su funcionamiento.'
  };
  const tooltip = document.createElement('div');
  tooltip.id = 'navigation-help'; tooltip.className = 'navigation-help';
  tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  document.body.append(tooltip);
  let current = null;
  function hide() {
    if (current) {
      const ids = (current.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== tooltip.id);
      if (ids.length) current.setAttribute('aria-describedby', ids.join(' '));
      else current.removeAttribute('aria-describedby');
    }
    tooltip.hidden = true; current = null;
  }
  function show(button) {
    if (button.classList.contains('active') || document.body.classList.contains('sidebar-collapsed')) return;
    hide(); current = button;
    tooltip.textContent = `${button.textContent.trim() || button.getAttribute('aria-label')}. ${descriptions[button.dataset.sectionNav]}`;
    button.setAttribute('aria-describedby', [button.getAttribute('aria-describedby'), tooltip.id].filter(Boolean).join(' '));
    tooltip.hidden = false;
    const rect = button.getBoundingClientRect(), width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    let left = rect.right + 12, top = rect.top;
    if (left + width > innerWidth - 12) { left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)); top = rect.bottom + 8; }
    if (top + height > innerHeight - 12) top = Math.max(12, rect.top - height - 8);
    tooltip.style.left = `${left}px`; tooltip.style.top = `${top}px`;
  }
  for (const button of sidebar.querySelectorAll('[data-section-nav]')) {
    if (!descriptions[button.dataset.sectionNav]) continue;
    button.removeAttribute('title');
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(button); });
    button.addEventListener('pointerleave', event => { if (!tooltip.contains(event.relatedTarget) && document.activeElement !== button) hide(); });
    button.addEventListener('focus', () => show(button));
    button.addEventListener('blur', hide);
    button.addEventListener('click', hide);
  }
  tooltip.addEventListener('pointerleave', event => { if (current && !current.contains(event.relatedTarget) && document.activeElement !== current) hide(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !tooltip.hidden) { hide(); event.stopPropagation(); }
  }, true);
  sidebar.addEventListener('scroll', hide, true);
  sidebar.addEventListener('toggle', hide, true);
  window.addEventListener('resize', hide);
  new MutationObserver(hide).observe(document.body, {attributes:true, attributeFilter:['class']});
})();
