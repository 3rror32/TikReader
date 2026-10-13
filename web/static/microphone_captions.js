/* Browser microphone recognition and the operator view for live captions. */
(() => {
  const app = document.querySelector('.app');
  if (!app) return;

  const section = document.createElement('section');
  section.dataset.section = 'microphone-captions';
  section.className = 'microphone-captions-page';
  section.setAttribute('aria-labelledby', 'mic-caption-title');
  section.innerHTML = `
    <header class="mic-caption-heading">
      <div>
        <span class="mic-caption-kicker">AUDIO EN PANTALLA</span>
        <h2 id="mic-caption-title">Subtítulos del micrófono</h2>
        <p id="mic-caption-heading-copy">Tu voz se convierte en subtítulos para la transmisión. TikReader no guarda el audio ni añade la transcripción al historial.</p>
      </div>
      <div class="mic-caption-header-controls">
        <button class="mic-caption-start" id="mic-caption-start" type="button" aria-pressed="false" aria-describedby="mic-caption-state mic-caption-permission">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4m-3 7v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8"/></svg>
          <span id="mic-caption-start-label">Activar micrófono</span>
        </button>
        <div class="mic-caption-state" id="mic-caption-state" data-state="idle" role="status" aria-live="polite">
          <i aria-hidden="true"></i><span>Comprobando servicio</span>
        </div>
      </div>
    </header>

    <div class="mic-caption-layout">
      <div class="mic-caption-main">
        <article class="mic-caption-console" aria-labelledby="mic-caption-control-title">
          <div class="mic-caption-console-top">
            <div><span class="mic-caption-index">ENTRADA</span><h3 id="mic-caption-control-title">Micrófono local</h3></div>
            <span class="mic-caption-light-note">Dispositivo predeterminado de Windows</span>
          </div>
          <div class="mic-caption-language-summary" id="mic-caption-language-summary" role="status" aria-live="polite">
            <span class="mic-caption-language-tag" id="mic-caption-language-tag">Español (México)</span>
            <span><strong id="mic-caption-language-engine">Motor local incluido</strong><small id="mic-caption-language-detail">La variante regional identifica tus subtítulos; las opciones en español comparten el mismo motor local.</small></span>
          </div>
          <p class="mic-caption-permission" id="mic-caption-permission">Comprobando el motor local de subtítulos…</p>
          <div class="mic-caption-meter" id="mic-caption-meter" role="meter" aria-label="Nivel del micrófono" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="mic-caption-meter-bars" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <small id="mic-caption-meter-readout">En espera</small>
          </div>
          <fieldset class="mic-caption-processing" id="mic-caption-processing">
            <legend><span>MEJORAS DE ENTRADA</span><small id="mic-caption-processing-status" role="status">Se aplican antes de reconocer tus palabras</small></legend>
            <div>
              <label class="mic-caption-processing-toggle">
                <input id="mic-caption-noise-suppression" type="checkbox" checked>
                <span class="mic-caption-processing-check" aria-hidden="true"></span>
                <span><strong>Reducir ruido</strong><small>Atenúa ventiladores y ruido constante.</small></span>
              </label>
              <label class="mic-caption-processing-toggle">
                <input id="mic-caption-echo-cancellation" type="checkbox" checked>
                <span class="mic-caption-processing-check" aria-hidden="true"></span>
                <span><strong>Cancelar eco</strong><small>Evita que las bocinas regresen al micrófono.</small></span>
              </label>
              <label class="mic-caption-processing-toggle">
                <input id="mic-caption-auto-gain" type="checkbox" checked>
                <span class="mic-caption-processing-check" aria-hidden="true"></span>
                <span><strong>Nivelar volumen</strong><small>Compensa una voz demasiado baja o alta.</small></span>
              </label>
            </div>
          </fieldset>
        </article>

        <article class="mic-caption-preview-card" aria-labelledby="mic-caption-preview-title">
          <div class="mic-caption-console-top">
            <div><span class="mic-caption-index">SALIDA</span><h3 id="mic-caption-preview-title">Vista previa</h3></div>
            <span id="mic-caption-preview-mode">ESPERANDO VOZ</span>
          </div>
          <div class="mic-caption-preview" id="mic-caption-preview" data-position="bottom">
            <div class="mic-caption-safe-area" aria-hidden="true"></div>
            <p id="mic-caption-preview-text">Aquí aparecerá lo que digas</p>
          </div>
          <div class="mic-caption-preview-actions">
            <button id="mic-caption-test" type="button">Mostrar texto de prueba</button>
            <button id="mic-caption-replay" type="button">Repetir animación</button>
            <button id="mic-caption-clear" type="button">Borrar subtítulo</button>
          </div>
        </article>
      </div>

      <aside class="mic-caption-settings" aria-labelledby="mic-caption-settings-title">
        <div class="mic-caption-console-top">
          <div><span class="mic-caption-index">CONFIGURACIÓN</span><h3 id="mic-caption-settings-title">Tu subtítulo</h3></div>
        </div>
        <div class="mic-caption-signal-path" aria-label="Ruta del subtítulo">
          <span><i aria-hidden="true"></i><small>VOZ</small><strong>Micrófono</strong></span>
          <span id="mic-caption-path-model"><i aria-hidden="true"></i><small>PROCESO</small><strong>Local</strong></span>
          <span><i aria-hidden="true"></i><small>SALIDA</small><strong>Overlay</strong></span>
        </div>
        <form id="mic-caption-form">
          <section class="mic-caption-ai-settings" aria-labelledby="mic-caption-ai-title">
            <div class="mic-caption-ai-heading">
              <div><span class="mic-caption-ai-mark" aria-hidden="true">AI</span><span><strong id="mic-caption-ai-title">Mejorar con IA externa</strong><small>Corrige puntuación y legibilidad al terminar cada frase.</small></span></div>
              <label class="mic-caption-switch" aria-label="Usar modelo de IA externo">
                <input id="mic-caption-ai-enabled" type="checkbox" aria-controls="mic-caption-ai-fields"><span aria-hidden="true"></span>
              </label>
            </div>
            <div class="mic-caption-ai-fields" id="mic-caption-ai-fields" hidden>
              <p class="mic-caption-privacy-note"><strong>Solo se envía el texto.</strong> El audio nunca sale de TikReader.</p>
              <label>Dirección del proveedor
                <input id="mic-caption-ai-endpoint" type="url" value="https://api.openai.com/v1" placeholder="https://api.openai.com/v1" spellcheck="false">
              </label>
              <div class="mic-caption-field-row">
                <label>Modelo<input id="mic-caption-ai-model" type="text" placeholder="gpt-4.1-mini" maxlength="120" spellcheck="false"></label>
                <label>Clave API<input id="mic-caption-ai-key" type="password" placeholder="Opcional para modelos locales" maxlength="1000" autocomplete="new-password"></label>
              </div>
              <label>Instrucción
                <textarea id="mic-caption-ai-instruction" rows="3" maxlength="500">Corrige puntuación, mayúsculas y errores evidentes sin cambiar el sentido ni añadir información. Devuelve únicamente el subtítulo corregido.</textarea>
              </label>
              <div class="mic-caption-ai-actions">
                <button id="mic-caption-ai-test" type="button">Probar conexión</button>
                <button id="mic-caption-ai-remove" type="button">Quitar clave</button>
              </div>
              <p id="mic-caption-ai-status" class="mic-caption-ai-status" role="status"></p>
            </div>
          </section>

          <section class="mic-caption-form-section" aria-labelledby="mic-caption-content-title">
            <div class="mic-caption-form-heading"><span>01</span><h4 id="mic-caption-content-title">Contenido y ritmo</h4></div>
            <label>Idioma de reconocimiento
              <select id="mic-caption-language" aria-describedby="mic-caption-language-help">
                <option value="es-MX">Español — México</option>
                <option value="es-US">Español — Estados Unidos</option>
                <option value="es-ES">Español — España</option>
                <option value="en-US">English — United States</option>
              </select>
              <small class="mic-caption-language-help" id="mic-caption-language-help">El motor local incluido reconoce español.</small>
            </label>
            <label>Tiempo visible después de terminar
              <span class="mic-caption-range"><input id="mic-caption-duration" type="range" min="2" max="20" value="5"><output id="mic-caption-duration-output">5 s</output></span>
              <small class="mic-caption-duration-help">Comienza al terminar una frase.</small>
            </label>
            <label class="mic-caption-check"><input id="mic-caption-pause-voice" type="checkbox" checked><span>Pausar mientras habla la voz de TikReader</span></label>
          </section>

          <section class="mic-caption-form-section" aria-labelledby="mic-caption-style-title">
            <div class="mic-caption-form-heading"><span>02</span><h4 id="mic-caption-style-title">Apariencia</h4></div>
            <div class="mic-caption-field-row">
              <label>Posición
                <select id="mic-caption-position">
                  <option value="top">Arriba</option>
                  <option value="center">Centro</option>
                  <option value="bottom">Abajo</option>
                </select>
              </label>
              <label>Tamaño
                <input id="mic-caption-size" type="number" min="20" max="96" step="1" value="48">
              </label>
            </div>
            <div class="mic-caption-field-row">
              <label>Fuente
                <select id="mic-caption-font">
                  <option value="system">Moderna</option><option value="impact">Impacto</option><option value="rounded">Redondeada</option>
                  <option value="mono">Monoespaciada</option><option value="serif">Elegante</option><option value="handwritten">Manuscrita</option>
                  <option value="condensed">Condensada</option><option value="futuristic">Futurista</option>
                </select>
              </label>
              <label>Estilo
                <select id="mic-caption-text-style">
                  <option value="solid">Sólido</option><option value="outline">Contorno</option><option value="neon">Neón</option><option value="label">Etiqueta</option>
                </select>
              </label>
            </div>
            <div class="mic-caption-field-row">
              <label>Sombra
                <select id="mic-caption-shadow">
                  <option value="none">Sin sombra</option><option value="soft">Suave</option><option value="strong">Fuerte</option><option value="glow">Resplandor</option>
                </select>
              </label>
              <label>Animación
                <select id="mic-caption-animation">
                  <option value="none">Sin animación</option><option value="fade">Aparecer</option><option value="slide">Subir</option><option value="drop">Bajar</option>
                  <option value="left">Desde la izquierda</option><option value="right">Desde la derecha</option><option value="pop">Zoom</option><option value="bounce">Rebote</option>
                  <option value="flip">Giro 3D</option><option value="blur">Enfoque</option><option value="swing">Balanceo</option><option value="typewriter">Máquina de escribir</option>
                </select>
              </label>
            </div>
            <div class="mic-caption-field-row">
              <label>Texto<input id="mic-caption-text-color" type="color" value="#ffffff"></label>
              <label>Fondo<input id="mic-caption-background" type="color" value="#101925"></label>
            </div>
            <fieldset class="mic-caption-palettes">
              <legend>Colores rápidos</legend>
              <div role="group" aria-label="Combinaciones de color">
                <button type="button" data-text-color="#ffffff" data-background="#101925" style="--swatch-text:#ffffff;--swatch-bg:#101925" aria-label="Clásico" title="Clásico"></button>
                <button type="button" data-text-color="#71fff0" data-background="#062a2f" style="--swatch-text:#71fff0;--swatch-bg:#062a2f" aria-label="Aqua" title="Aqua"></button>
                <button type="button" data-text-color="#ffe27a" data-background="#2a1b05" style="--swatch-text:#ffe27a;--swatch-bg:#2a1b05" aria-label="Dorado" title="Dorado"></button>
                <button type="button" data-text-color="#ffb3cc" data-background="#2b0b1b" style="--swatch-text:#ffb3cc;--swatch-bg:#2b0b1b" aria-label="Rosa" title="Rosa"></button>
                <button type="button" data-text-color="#bde6ff" data-background="#071f35" style="--swatch-text:#bde6ff;--swatch-bg:#071f35" aria-label="Cielo" title="Cielo"></button>
                <button type="button" data-text-color="#ddc8ff" data-background="#1a0d33" style="--swatch-text:#ddc8ff;--swatch-bg:#1a0d33" aria-label="Violeta" title="Violeta"></button>
                <button type="button" data-text-color="#cbff8a" data-background="#152708" style="--swatch-text:#cbff8a;--swatch-bg:#152708" aria-label="Lima" title="Lima"></button>
                <button type="button" data-text-color="#ffd0c8" data-background="#36100b" style="--swatch-text:#ffd0c8;--swatch-bg:#36100b" aria-label="Coral" title="Coral"></button>
              </div>
            </fieldset>
            <label class="mic-caption-check"><input id="mic-caption-transparent-background" type="checkbox"><span>Fondo transparente</span></label>
          </section>

          <button class="mic-caption-save" type="submit">Guardar cambios</button>
          <p id="mic-caption-save-status" class="mic-caption-save-status" role="status"></p>
        </form>

        <div class="mic-caption-stream">
          <span class="mic-caption-stream-label">FUENTE PARA STREAM</span>
          <p>Añade esta dirección como <strong>Fuente de navegador</strong>.</p>
          <code id="mic-caption-url"></code>
          <div>
            <button id="mic-caption-copy" type="button">Copiar dirección</button>
            <a id="mic-caption-open" target="_blank" rel="noopener noreferrer">Abrir overlay</a>
          </div>
        </div>
      </aside>
    </div>`;
  window.OperatorViewRegistry.register(section.dataset.section,section);

  const $ = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LocalAudioContext = window.AudioContext || window.webkitAudioContext;
  const localAudioSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && LocalAudioContext);
  const isDesktopApp = Boolean(
    (window.qt && window.qt.webChannelTransport) || /QtWebEngine/i.test(navigator.userAgent || '')
  );
  const useLocalRecognition = Boolean(localAudioSupported && (isDesktopApp || !Recognition));
  const recognitionSupported = Boolean(useLocalRecognition || Recognition);
  const status = $('mic-caption-state');
  const startButton = $('mic-caption-start');
  const startLabel = $('mic-caption-start-label');
  const permission = $('mic-caption-permission');
  const headingCopy = $('mic-caption-heading-copy');
  const languageTag = $('mic-caption-language-tag');
  const languageEngine = $('mic-caption-language-engine');
  const languageDetail = $('mic-caption-language-detail');
  const languageHelp = $('mic-caption-language-help');
  const meter = $('mic-caption-meter');
  const meterBars = [...meter.querySelectorAll('.mic-caption-meter-bars span')];
  const meterReadout = $('mic-caption-meter-readout');
  const preview = $('mic-caption-preview');
  const previewText = $('mic-caption-preview-text');
  const previewMode = $('mic-caption-preview-mode');
  const form = $('mic-caption-form');
  const duration = $('mic-caption-duration');
  const durationOutput = $('mic-caption-duration-output');
  const processingStatus = $('mic-caption-processing-status');
  const aiEnabled = $('mic-caption-ai-enabled');
  const aiFields = $('mic-caption-ai-fields');
  const aiStatus = $('mic-caption-ai-status');
  const processingControls = [
    ['mic-caption-noise-suppression', 'noiseSuppression'],
    ['mic-caption-echo-cancellation', 'echoCancellation'],
    ['mic-caption-auto-gain', 'autoGainControl']
  ];
  const overlayUrl = window.overlayUrl ? window.overlayUrl('/widget/microphone-captions') : `${location.origin}/widget/microphone-captions`;
  const urlCode = $('mic-caption-url');
  let settings = null;
  let recognition = null;
  let desired = false;
  let running = false;
  let voiceSpeaking = Boolean(window.TikReaderVoiceState && window.TikReaderVoiceState.speaking);
  let restartTimer = 0;
  let interimTimer = 0;
  let lastInterim = '';
  let localEngineReady = !useLocalRecognition;
  let localStream = null;
  let localContext = null;
  let localSource = null;
  let localProcessor = null;
  let localSilence = null;
  let localPcm = [];
  let localSamples = 0;
  let localSendChain = Promise.resolve();
  let localStopping = false;
  let engineCheckId = 0;
  let smoothedMeterLevel = 0;
  let previewWordTimer = 0;
  let previewWordQueue = [];
  let previewWords = [];
  let previewWasInterim = false;
  let aiKeyConfigured = false;
  let aiRefineId = 0;

  const languageInfo = {
    'es-MX': {label: 'Español (México)'},
    'es-US': {label: 'Español (Estados Unidos)'},
    'es-ES': {label: 'Español (España)'},
    'en-US': {label: 'Inglés (Estados Unidos)'}
  };

  urlCode.textContent = overlayUrl;
  $('mic-caption-open').href = overlayUrl;
  if (useLocalRecognition) {
    const english = $('mic-caption-language').querySelector('option[value="en-US"]');
    if (english) {
      english.disabled = true;
      english.textContent = 'English — requiere reconocimiento del navegador';
    }
  }

  function recognitionLanguage() {
    const value = settings && settings.language;
    return ['es-MX', 'es-US', 'es-ES', 'en-US'].includes(value) ? value : 'es-MX';
  }

  function selectedLanguageDetails() {
    const language = recognitionLanguage();
    const info = languageInfo[language] || languageInfo['es-MX'];
    if (useLocalRecognition) {
      const supported = language.startsWith('es-');
      return {
        ...info,
        language,
        supported,
        engine: supported ? 'Motor local incluido' : 'Requiere reconocimiento del navegador',
        detail: supported
          ? 'La variante regional identifica tus subtítulos; las opciones en español comparten el mismo motor local.'
          : 'El motor incluido solo reconoce español. Abre TikReader en un navegador compatible para reconocer inglés.',
        heading: supported
          ? `Tu voz se reconoce en ${info.label} con el motor local incluido. El audio no sale de TikReader ni se guarda.`
          : `${info.label} no está disponible con el motor local incluido. El audio nunca se guarda.`,
        help: supported
          ? 'Se procesa en este equipo. Las variantes de español usan el mismo modelo local.'
          : 'No disponible en la aplicación de escritorio con el motor incluido.'
      };
    }
    return {
      ...info,
      language,
      supported: true,
      engine: 'Servicio de voz del navegador',
      detail: 'El idioma seleccionado cambia el servicio que interpreta tu voz y puede requerir conexión a Internet.',
      heading: `Tu voz se reconoce en ${info.label} mediante el servicio del navegador. TikReader no guarda el audio ni la transcripción.`,
      help: 'El navegador usa este idioma para interpretar pronunciación y vocabulario.'
    };
  }

  function syncLanguageInterface() {
    const info = selectedLanguageDetails();
    headingCopy.textContent = info.heading;
    languageTag.textContent = info.label;
    languageEngine.textContent = info.engine;
    languageDetail.textContent = info.detail;
    languageHelp.textContent = info.help;
    $('mic-caption-language-summary').classList.toggle('is-unavailable', !info.supported);
    return info;
  }

  function showReadyState(message) {
    const info = syncLanguageInterface();
    setStatus('ready', message || `${info.label} listo`);
    permission.textContent = useLocalRecognition
      ? `Activa el micrófono para probar ${info.label}. El reconocimiento se hace en este equipo.`
      : `Activa el micrófono para probar ${info.label}. El reconocimiento lo realiza el servicio de voz del navegador.`;
  }

  function audioProcessingConstraints(source = settings || {}) {
    return {
      echoCancellation: source.echo_cancellation !== false,
      noiseSuppression: source.noise_suppression !== false,
      autoGainControl: source.auto_gain_control !== false
    };
  }

  function audioProcessingSettings(source = settings || {}) {
    return {
      noise_suppression: source.noise_suppression !== false,
      echo_cancellation: source.echo_cancellation !== false,
      auto_gain_control: source.auto_gain_control !== false
    };
  }

  function applyProcessingControls(source) {
    $('mic-caption-noise-suppression').checked = source.noise_suppression !== false;
    $('mic-caption-echo-cancellation').checked = source.echo_cancellation !== false;
    $('mic-caption-auto-gain').checked = source.auto_gain_control !== false;
  }

  function syncProcessingAvailability() {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    let availableCount = 0;
    for (const [id, constraint] of processingControls) {
      const input = $(id);
      const available = useLocalRecognition && supported[constraint] !== false;
      input.disabled = !available;
      input.closest('.mic-caption-processing-toggle')?.classList.toggle('is-unavailable', !available);
      if (available) availableCount += 1;
    }
    if (!useLocalRecognition) {
      processingStatus.textContent = 'El servicio de voz del navegador controla estas mejoras';
    } else if (!availableCount) {
      processingStatus.textContent = 'El dispositivo no permite controlar estas mejoras';
    } else if (availableCount < processingControls.length) {
      processingStatus.textContent = 'Algunas mejoras no están disponibles en este dispositivo';
    } else {
      processingStatus.textContent = 'Se aplican antes de reconocer tus palabras';
    }
  }

  function localEndpoint(parameters = {}) {
    const query = new URLSearchParams({language: recognitionLanguage(), ...parameters});
    return `/microphone-captions/audio?${query}`;
  }

  function setStatus(kind, message) {
    status.dataset.state = kind;
    status.querySelector('span').textContent = message;
  }

  function microphoneErrorMessage(error) {
    const name = error && error.name;
    const message = error && error.message;
    if (message === 'El motor local de subtítulos no está listo') return message;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Windows bloqueó el acceso al micrófono. Permítelo en la configuración de privacidad y vuelve a intentarlo.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No se encontró un micrófono. Conecta uno o selecciona un dispositivo de entrada en Windows.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Otra aplicación está usando el micrófono o Windows no puede abrirlo. Cierra la otra aplicación y vuelve a intentarlo.';
    }
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return 'El micrófono no admite la configuración solicitada. Revisa el dispositivo de entrada de Windows.';
    }
    if (name === 'SecurityError') {
      return 'El acceso al micrófono está desactivado por la seguridad del navegador o de Windows.';
    }
    if (name === 'TypeError') {
      return 'No se pudo comunicar con el servicio local de subtítulos. Reinicia TikReader y vuelve a intentarlo.';
    }
    return 'No se pudo abrir el micrófono. Revisa que esté conectado y permitido en Windows.';
  }

  function setMeterLevel(samples) {
    let level = 0;
    if (samples && samples.length) {
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      level = Math.min(1, Math.sqrt(energy / samples.length) * 8.5);
      const smoothing = level > smoothedMeterLevel ? .58 : .2;
      smoothedMeterLevel += (level - smoothedMeterLevel) * smoothing;
    } else {
      smoothedMeterLevel = 0;
    }
    const displayedLevel = smoothedMeterLevel;
    meter.setAttribute('aria-valuenow', String(Math.round(displayedLevel * 100)));
    section.classList.toggle('has-live-meter', Boolean(samples && samples.length));
    const signal = !samples ? 'idle' : displayedLevel < .09 ? 'quiet' : displayedLevel > .78 ? 'high' : 'voice';
    meter.dataset.signal = signal;
    meterReadout.textContent = signal === 'idle'
      ? 'En espera'
      : signal === 'quiet'
        ? 'Señal baja'
        : signal === 'high' ? 'Volumen alto' : 'Recibiendo voz';
    meterBars.forEach((bar, index) => {
      const center = 1 - Math.abs((index - (meterBars.length - 1) / 2) / (meterBars.length / 2));
      const texture = .82 + ((index * 7) % 5) * .06;
      bar.style.setProperty('--bar-level', String(.58 + displayedLevel * (2.6 + center * 4.2) * texture));
    });
  }

  function setMeterListening() {
    if (useLocalRecognition) return;
    meter.dataset.signal = 'listening';
    meterReadout.textContent = 'Escuchando';
  }

  function stopPreviewWords() {
    clearTimeout(previewWordTimer);
    previewWordTimer = 0;
    previewWordQueue = [];
  }

  function commonPrefixLength(left, right) {
    const length = Math.min(left.length, right.length);
    let index = 0;
    while (index < length && left[index] === right[index]) index += 1;
    return index;
  }

  function renderPreviewWords(words, animateFrom = words.length) {
    previewText.replaceChildren();
    words.forEach((word, index) => {
      if (index) previewText.append(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'mic-caption-word';
      span.textContent = word;
      span.style.setProperty('--word-length', String(Math.max(1, Array.from(word).length)));
      if (index >= animateFrom && (preview.dataset.animation || 'fade') !== 'none') {
        span.classList.add('caption-word-animate');
        span.style.setProperty('--word-delay', `${(index - animateFrom) * 70}ms`);
      }
      previewText.append(span);
    });
    previewWords = words.slice();
  }

  function playNextPreviewWord() {
    clearTimeout(previewWordTimer);
    const word = previewWordQueue.shift();
    if (!word) {
      previewWordTimer = 0;
      return;
    }
    const nextWords = [...previewWords, word];
    renderPreviewWords(nextWords, nextWords.length - 1);
    previewWordTimer = setTimeout(playNextPreviewWord, 420);
  }

  function replayPreview() {
    const value = preview.dataset.captionValue || '';
    if (!value) return;
    stopPreviewWords();
    renderPreviewWords(value.split(/\s+/).filter(Boolean), 0);
  }

  function showPreview(text, interim = false, sequence = false) {
    const value = (text || '').trim();
    stopPreviewWords();
    preview.dataset.captionValue = value;
    preview.classList.toggle('has-caption', Boolean(value));
    preview.classList.toggle('is-interim', Boolean(value && interim));
    previewMode.textContent = value ? (interim ? 'FORMANDO FRASE…' : 'FRASE COMPLETA') : 'ESPERANDO VOZ';
    if (!value) {
      previewWords = [];
      previewWasInterim = false;
      previewText.textContent = 'Aquí aparecerá lo que digas';
      return;
    }
    const words = value.split(/\s+/).filter(Boolean);
    if (sequence) {
      previewWords = [];
      previewWasInterim = false;
      previewText.replaceChildren();
      previewWordQueue = words;
      playNextPreviewWord();
      return;
    }
    const startsNewPhrase = previewWords.length && !previewWasInterim;
    const animateFrom = startsNewPhrase ? 0 : commonPrefixLength(previewWords, words);
    renderPreviewWords(words, animateFrom);
    previewWasInterim = interim;
  }

  function readSettings() {
    return {
      language: $('mic-caption-language').value,
      position: $('mic-caption-position').value,
      font_size: Number($('mic-caption-size').value),
      font_family: $('mic-caption-font').value,
      text_style: $('mic-caption-text-style').value,
      shadow: $('mic-caption-shadow').value,
      animation: $('mic-caption-animation').value,
      text_color: $('mic-caption-text-color').value,
      background: $('mic-caption-background').value,
      duration: Number(duration.value),
      show_background: !$('mic-caption-transparent-background').checked,
      pause_during_voice: $('mic-caption-pause-voice').checked,
      noise_suppression: $('mic-caption-noise-suppression').checked,
      echo_cancellation: $('mic-caption-echo-cancellation').checked,
      auto_gain_control: $('mic-caption-auto-gain').checked,
      ai_enabled: aiEnabled.checked,
      ai_endpoint: $('mic-caption-ai-endpoint').value.trim(),
      ai_model: $('mic-caption-ai-model').value.trim(),
      ai_instruction: $('mic-caption-ai-instruction').value.trim()
    };
  }

  function syncAiInterface() {
    const enabled = aiEnabled.checked;
    aiFields.hidden = !enabled;
    $('mic-caption-form').querySelector('.mic-caption-ai-settings').classList.toggle('has-active-ai', enabled);
    const modelStep = $('mic-caption-path-model');
    modelStep.classList.toggle('is-external', enabled);
    modelStep.querySelector('strong').textContent = enabled ? 'IA externa' : 'Local';
    const key = $('mic-caption-ai-key');
    key.placeholder = aiKeyConfigured ? 'Clave protegida · escribe para reemplazarla' : 'Opcional para modelos locales';
    $('mic-caption-ai-remove').hidden = !aiKeyConfigured;
  }

  function applySettings(next, options = {}) {
    settings = {...next, language: ['es-MX', 'es-US', 'es-ES', 'en-US'].includes(next.language) ? next.language : 'es-MX'};
    $('mic-caption-language').value = settings.language;
    $('mic-caption-position').value = next.position;
    $('mic-caption-size').value = next.font_size;
    $('mic-caption-font').value = next.font_family || 'system';
    $('mic-caption-text-style').value = next.text_style || 'solid';
    $('mic-caption-shadow').value = next.shadow || 'soft';
    $('mic-caption-animation').value = next.animation || 'fade';
    $('mic-caption-text-color').value = next.text_color;
    $('mic-caption-background').value = next.background;
    duration.value = next.duration;
    durationOutput.value = `${next.duration} s`;
    durationOutput.textContent = `${next.duration} s`;
    $('mic-caption-transparent-background').checked = !next.show_background;
    $('mic-caption-pause-voice').checked = next.pause_during_voice;
    applyProcessingControls(next);
    aiEnabled.checked = next.ai_enabled === true;
    $('mic-caption-ai-endpoint').value = next.ai_endpoint || 'https://api.openai.com/v1';
    $('mic-caption-ai-model').value = next.ai_model || '';
    $('mic-caption-ai-instruction').value = next.ai_instruction || 'Corrige puntuación, mayúsculas y errores evidentes sin cambiar el sentido ni añadir información. Devuelve únicamente el subtítulo corregido.';
    syncAiInterface();
    preview.dataset.position = next.position;
    preview.dataset.font = next.font_family || 'system';
    preview.dataset.textStyle = next.text_style || 'solid';
    preview.dataset.shadow = next.shadow || 'soft';
    preview.dataset.animation = next.animation || 'fade';
    preview.style.setProperty('--caption-color', next.text_color);
    preview.style.setProperty('--caption-background', next.background);
    preview.style.setProperty('--caption-font-size', `${Math.max(18, Math.round(next.font_size * .55))}px`);
    preview.classList.toggle('without-background', !next.show_background);
    if (recognition) recognition.lang = settings.language;
    syncLanguageInterface();
    if (options.replay && preview.classList.contains('has-caption')) replayPreview();
  }

  async function update(data, method = 'POST') {
    const response = await fetch('/microphone-captions/state', {
      method,
      headers: {'Content-Type': 'application/json'},
      body: method === 'GET' ? undefined : JSON.stringify(data)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar');
    return payload;
  }

  async function aiRequest(data, method = 'POST') {
    const response = await fetch('/microphone-captions/ai', {
      method,
      headers: {'Content-Type': 'application/json'},
      body: method === 'DELETE' ? undefined : JSON.stringify(data)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo conectar con el modelo');
    return payload;
  }

  function aiConnectionPayload(extra = {}) {
    return {
      ai_enabled: aiEnabled.checked,
      ai_endpoint: $('mic-caption-ai-endpoint').value.trim(),
      ai_model: $('mic-caption-ai-model').value.trim(),
      ai_instruction: $('mic-caption-ai-instruction').value.trim(),
      api_key: $('mic-caption-ai-key').value.trim(),
      ...extra
    };
  }

  async function refineCaption(text) {
    if (!settings?.ai_enabled) return text;
    const requestId = ++aiRefineId;
    previewMode.textContent = 'MEJORANDO CON IA…';
    try {
      const response = await fetch('/microphone-captions/ai/refine', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo mejorar el texto');
      if (requestId !== aiRefineId) return '';
      aiStatus.textContent = 'Modelo conectado · última frase mejorada.';
      return payload.text || text;
    } catch (error) {
      if (requestId !== aiRefineId) return '';
      aiStatus.textContent = `${error.message}. Se mostró la transcripción original.`;
      return text;
    }
  }

  async function sendTranscript(text, interim) {
    const clean = text.trim();
    if (!clean) return;
    showPreview(clean, interim);
    if (interim) {
      lastInterim = clean;
      clearTimeout(interimTimer);
      interimTimer = setTimeout(() => update({text: lastInterim, interim: true}).catch(() => {}), 140);
      return;
    }
    clearTimeout(interimTimer);
    lastInterim = '';
    const refined = await refineCaption(clean);
    if (!refined) return;
    showPreview(refined, false);
    try { await update({text: refined, interim: false}); }
    catch (_) { setStatus('error', 'No se pudo enviar el subtítulo'); }
  }

  function syncButtons() {
    const available = recognitionSupported && (!useLocalRecognition || localEngineReady);
    startButton.disabled = !available;
    startButton.classList.toggle('is-active', desired);
    startButton.setAttribute('aria-pressed', String(desired));
    startLabel.textContent = desired ? 'Detener micrófono' : 'Activar micrófono';
    section.classList.toggle('is-listening', running);
  }

  function pcm16(buffer, inputRate) {
    const ratio = inputRate / 16000;
    const length = Math.max(1, Math.round(buffer.length / ratio));
    const output = new Int16Array(length);
    for (let index = 0; index < length; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.min(buffer.length, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) sum += buffer[sourceIndex];
      const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
      output[index] = sample < 0 ? sample * 32768 : sample * 32767;
    }
    return output;
  }

  function handleLocalResult(payload) {
    if (payload && payload.text) {
      showPreview(payload.text, payload.interim);
      if (!payload.interim && payload.final) sendTranscript(payload.text, false);
    }
  }

  function sendLocalAudio(force = false) {
    if (!localSamples || (!force && localSamples < 8000)) return;
    const batch = new Int16Array(localSamples);
    let offset = 0;
    for (const chunk of localPcm) { batch.set(chunk, offset); offset += chunk.length; }
    localPcm = [];
    localSamples = 0;
    localSendChain = localSendChain.then(async () => {
      const response = await fetch(localEndpoint(), {
        method: 'POST',
        headers: {'Content-Type': 'audio/pcm'},
        body: batch.buffer
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo reconocer la voz');
      handleLocalResult(payload);
    }).catch(error => {
      desired = false;
      setStatus('error', error.message);
      permission.textContent = 'No se pudo iniciar el reconocimiento de voz.';
      syncButtons();
      setTimeout(() => stopLocalRecognition(false), 0);
    });
  }

  function teardownLocalAudio() {
    if (localProcessor) localProcessor.disconnect();
    if (localSource) localSource.disconnect();
    if (localSilence) localSilence.disconnect();
    if (localStream) for (const track of localStream.getTracks()) track.stop();
    if (localContext) localContext.close().catch(() => {});
    localStream = localContext = localSource = localProcessor = localSilence = null;
    setMeterLevel(null);
  }

  async function stopLocalRecognition(preserveIntent = false) {
    if (localStopping) return;
    localStopping = true;
    teardownLocalAudio();
    if (preserveIntent) {
      localPcm = [];
      localSamples = 0;
    } else {
      sendLocalAudio(true);
    }
    try {
      await localSendChain;
      if (preserveIntent) {
        await fetch(localEndpoint(), {method: 'DELETE'});
      } else {
        const response = await fetch(localEndpoint({final: '1'}), {method: 'POST'});
        const payload = await response.json();
        if (response.ok) {
          handleLocalResult(payload);
        }
      }
    } catch (_) {}
    running = false;
    if (!preserveIntent) {
      desired = false;
      showReadyState();
    }
    update({listening: false}).catch(() => {});
    localStopping = false;
    syncButtons();
  }

  async function beginLocalRecognition() {
    if (localStopping) {
      restartTimer = setTimeout(beginLocalRecognition, 250);
      return;
    }
    try {
      const engineResponse = await fetch(localEndpoint(), {method: 'DELETE'});
      const engine = await engineResponse.json();
      if (!engine.available) throw new Error('El motor local de subtítulos no está listo');
      localStream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, ...audioProcessingConstraints()}});
      localContext = new LocalAudioContext();
      if (localContext.state === 'suspended') await localContext.resume();
      localSource = localContext.createMediaStreamSource(localStream);
      localProcessor = localContext.createScriptProcessor(4096, 1, 1);
      localSilence = localContext.createGain();
      localSilence.gain.value = 0;
      localProcessor.onaudioprocess = event => {
        const samples = event.inputBuffer.getChannelData(0);
        setMeterLevel(samples);
        const chunk = pcm16(samples, localContext.sampleRate);
        localPcm.push(chunk);
        localSamples += chunk.length;
        sendLocalAudio(false);
      };
      localSource.connect(localProcessor);
      localProcessor.connect(localSilence);
      localSilence.connect(localContext.destination);
      for (const track of localStream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (!running || localStopping) return;
          desired = false;
          running = false;
          teardownLocalAudio();
          setStatus('error', 'Micrófono desconectado');
          permission.textContent = 'Se perdió el dispositivo de entrada. Reconéctalo y pulsa Activar micrófono.';
          update({listening: false}).catch(() => {});
          syncButtons();
        }, {once: true});
      }
      running = true;
      setStatus('live', `Escuchando en ${selectedLanguageDetails().label}`);
      permission.textContent = 'Habla con naturalidad. La transcripción aparecerá aquí y en el overlay.';
      update({listening: true}).catch(() => {});
      syncButtons();
    } catch (error) {
      teardownLocalAudio();
      desired = false;
      setStatus('error', 'No se pudo iniciar el micrófono');
      permission.textContent = microphoneErrorMessage(error);
      syncButtons();
    }
  }

  function stopRecognition(preserveIntent = false) {
    clearTimeout(restartTimer);
    if (localStream || localStopping) {
      if (!preserveIntent) desired = false;
      stopLocalRecognition(preserveIntent);
      return;
    }
    if (!preserveIntent) desired = false;
    if (recognition && running) {
      try { recognition.stop(); } catch (_) {}
    }
    running = false;
    syncButtons();
    update({listening: false}).catch(() => {});
    if (!preserveIntent) {
      showReadyState();
    }
  }

  function beginRecognition() {
    if (!desired || running || !recognitionSupported) return;
    if (settings && settings.pause_during_voice && voiceSpeaking) {
      setStatus('waiting', 'En espera mientras habla TikReader');
      return;
    }
    if (useLocalRecognition) {
      beginLocalRecognition();
      return;
    }
    if (!recognition) {
      recognition = new Recognition();
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        running = true;
        setMeterListening();
        setStatus('live', `Escuchando en ${selectedLanguageDetails().label}`);
        permission.textContent = 'Habla con naturalidad. La transcripción aparecerá aquí y en el overlay.';
        syncButtons();
        update({listening: true}).catch(() => {});
      };
      recognition.onresult = event => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const phrase = event.results[index][0].transcript;
          if (event.results[index].isFinal) finalText += phrase;
          else interimText += phrase;
        }
        if (finalText.trim()) {
          sendTranscript(finalText, false);
        }
        else if (interimText.trim()) sendTranscript(interimText, true);
      };
      recognition.onerror = event => {
        const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        if (denied) {
          desired = false;
          permission.textContent = 'El permiso del micrófono está bloqueado. Actívalo y vuelve a intentarlo.';
          setStatus('error', 'Permiso de micrófono bloqueado');
        } else if (event.error === 'audio-capture') {
          desired = false;
          permission.textContent = 'No se encontró un micrófono disponible. Revisa el dispositivo de entrada de Windows.';
          setStatus('error', 'Micrófono no disponible');
        } else if (event.error === 'language-not-supported') {
          desired = false;
          permission.textContent = 'El servicio de reconocimiento no admite el idioma seleccionado. Elige otro idioma y vuelve a intentarlo.';
          setStatus('error', 'Idioma no disponible');
        } else if (event.error === 'network') {
          desired = false;
          permission.textContent = 'El reconocimiento del navegador perdió la conexión. Revisa internet y vuelve a intentarlo.';
          setStatus('error', 'Servicio de voz sin conexión');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setStatus('error', 'No se pudo reconocer la voz');
        }
        syncButtons();
      };
      recognition.onend = () => {
        running = false;
        setMeterLevel(null);
        syncButtons();
        update({listening: false}).catch(() => {});
        if (desired && !(settings && settings.pause_during_voice && voiceSpeaking)) {
          restartTimer = setTimeout(beginRecognition, 350);
        }
      };
    }
    recognition.continuous = true;
    recognition.lang = recognitionLanguage();
    try { recognition.start(); }
    catch (_) { restartTimer = setTimeout(beginRecognition, 450); }
  }

  startButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (desired) {
      stopRecognition(false);
      return;
    }
    desired = true;
    setStatus('waiting', `Activando ${selectedLanguageDetails().label}`);
    permission.textContent = 'Windows puede pedir permiso la primera vez. No se guarda el audio.';
    syncButtons();
    beginRecognition();
  });

  duration.addEventListener('input', () => {
    durationOutput.value = `${duration.value} s`;
    durationOutput.textContent = `${duration.value} s`;
  });
  aiEnabled.addEventListener('change', syncAiInterface);
  processingControls.forEach(([id]) => {
    $(id).addEventListener('change', async () => {
      const previous = audioProcessingSettings();
      const next = {
        noise_suppression: $('mic-caption-noise-suppression').checked,
        echo_cancellation: $('mic-caption-echo-cancellation').checked,
        auto_gain_control: $('mic-caption-auto-gain').checked
      };
      try {
        const track = localStream?.getAudioTracks?.()[0];
        if (track?.applyConstraints) await track.applyConstraints(audioProcessingConstraints(next));
        const state = await update({settings: next});
        settings = {...settings, ...audioProcessingSettings(state.settings)};
        applyProcessingControls(state.settings);
        processingStatus.textContent = track
          ? 'Mejoras actualizadas en el micrófono activo'
          : 'Se aplicarán la próxima vez que actives el micrófono';
      } catch (_) {
        applyProcessingControls(previous);
        const track = localStream?.getAudioTracks?.()[0];
        if (track?.applyConstraints) track.applyConstraints(audioProcessingConstraints(previous)).catch(() => {});
        processingStatus.textContent = 'El dispositivo no pudo aplicar este cambio';
      }
    });
  });
  form.addEventListener('input', event => {
    const previousLanguage = recognitionLanguage();
    applySettings(readSettings(), {replay: event.target.id === 'mic-caption-animation'});
    if (event.target.id === 'mic-caption-language' && recognitionLanguage() !== previousLanguage) {
      loadEngineStatus();
      if (desired) {
        clearTimeout(restartTimer);
        if (useLocalRecognition) {
          stopLocalRecognition(true).then(() => { if (desired) beginLocalRecognition(); });
        } else {
          const previous = recognition;
          recognition = null;
          running = false;
          try { previous?.abort(); } catch (_) {}
          restartTimer = setTimeout(beginRecognition, 250);
        }
      }
    }
  });
  form.querySelectorAll('.mic-caption-palettes button').forEach(button => {
    button.addEventListener('click', () => {
      $('mic-caption-text-color').value = button.dataset.textColor;
      $('mic-caption-background').value = button.dataset.background;
      applySettings(readSettings(), {replay: true});
      form.querySelectorAll('.mic-caption-palettes button').forEach(item => item.classList.toggle('selected', item === button));
    });
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const output = $('mic-caption-save-status');
    try {
      const aiState = await aiRequest(aiConnectionPayload());
      aiKeyConfigured = Boolean(aiState.ai_key_configured);
      $('mic-caption-ai-key').value = '';
      const state = await update({settings: readSettings()});
      applySettings(state.settings);
      output.textContent = 'Cambios guardados.';
      setTimeout(() => { if (output.textContent === 'Cambios guardados.') output.textContent = ''; }, 2500);
    } catch (error) { output.textContent = error.message; }
  });

  $('mic-caption-ai-test').addEventListener('click', async () => {
    const button = $('mic-caption-ai-test');
    button.disabled = true;
    aiStatus.textContent = 'Comprobando conexión…';
    try {
      const result = await aiRequest(aiConnectionPayload({test: true}));
      aiStatus.textContent = `${result.message}. El modelo respondió correctamente.`;
    } catch (error) {
      aiStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  $('mic-caption-ai-remove').addEventListener('click', async () => {
    try {
      const state = await aiRequest({}, 'DELETE');
      aiKeyConfigured = false;
      applySettings(state.settings);
      aiStatus.textContent = 'Clave eliminada y modelo externo desactivado.';
    } catch (error) { aiStatus.textContent = error.message; }
  });

  $('mic-caption-test').addEventListener('click', async () => {
    const sample = 'Este es un subtítulo de prueba para tu transmisión';
    showPreview(sample, false, true);
    try { await update({text: sample, interim: false}); }
    catch (_) { setStatus('error', 'No se pudo mostrar la prueba'); }
  });
  $('mic-caption-replay').addEventListener('click', () => {
    if (!preview.dataset.captionValue) showPreview('Este es un subtítulo de prueba para tu transmisión', false);
    else replayPreview();
  });
  $('mic-caption-clear').addEventListener('click', async () => {
    showPreview('', false);
    try { await update({clear: true}); } catch (_) {}
  });
  $('mic-caption-copy').addEventListener('click', async event => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      event.currentTarget.textContent = 'Dirección copiada';
      setTimeout(() => { event.currentTarget.textContent = 'Copiar dirección'; }, 2200);
    } catch (_) {
      event.currentTarget.textContent = 'No se pudo copiar';
    }
  });

  window.addEventListener('tikreader:voice-state', event => {
    voiceSpeaking = Boolean(event.detail && event.detail.speaking);
    if (!desired || !settings || !settings.pause_during_voice) return;
    if (voiceSpeaking) {
      stopRecognition(true);
      setStatus('waiting', 'En espera mientras habla TikReader');
    } else {
      setStatus('waiting', 'Reanudando micrófono');
      beginRecognition();
    }
  });
  window.addEventListener('pagehide', () => {
    if (!desired) return;
    const body = JSON.stringify({listening: false});
    navigator.sendBeacon('/microphone-captions/state', new Blob([body], {type: 'application/json'}));
  });

  if (!recognitionSupported) {
    startButton.disabled = true;
    setStatus('error', 'Micrófono no disponible');
    permission.textContent = 'Windows no informó un dispositivo de entrada disponible.';
  }

  async function loadEngineStatus() {
    const info = syncLanguageInterface();
    if (!useLocalRecognition) {
      if (recognitionSupported) {
        showReadyState();
      }
      syncButtons();
      return;
    }
    const checkId = ++engineCheckId;
    const language = recognitionLanguage();
    localEngineReady = false;
    setStatus('waiting', 'Comprobando servicio local');
    permission.textContent = 'Comprobando el reconocimiento de voz para el idioma seleccionado…';
    syncButtons();
    try {
      const response = await fetch(`/microphone-captions/engine?language=${encodeURIComponent(language)}`);
      const engine = await response.json();
      if (checkId !== engineCheckId || language !== recognitionLanguage()) return;
      localEngineReady = Boolean(response.ok && engine.available);
      if (localEngineReady) {
        showReadyState(`${info.label} listo`);
      } else {
        setStatus('error', `${info.label} no disponible`);
        permission.textContent = engine.error || (engine.model_ready ? 'Falta instalar el motor de subtítulos.' : 'Falta el modelo local de español.');
      }
    } catch (_) {
      if (checkId !== engineCheckId || language !== recognitionLanguage()) return;
      localEngineReady = false;
      setStatus('error', 'No se pudo comprobar el servicio');
      permission.textContent = 'Reinicia TikReader y vuelve a abrir esta sección.';
    }
    syncButtons();
  }

  syncButtons();
  syncProcessingAvailability();
  async function initialize() {
    try {
      const response = await fetch('/microphone-captions/state');
      if (!response.ok) throw new Error('No se pudo cargar la configuración');
      const state = await response.json();
      aiKeyConfigured = Boolean(state.ai_key_configured);
      applySettings(state.settings);
      if (state.text) showPreview(state.text, state.interim);
    } catch (_) {
      applySettings({language:'es-MX', duration:5, position:'bottom', font_size:48, text_color:'#ffffff', background:'#101925', show_background:true, pause_during_voice:true, noise_suppression:true, echo_cancellation:true, auto_gain_control:true, font_family:'system', text_style:'solid', shadow:'soft', animation:'fade', ai_enabled:false, ai_endpoint:'https://api.openai.com/v1', ai_model:'', ai_instruction:'Corrige puntuación, mayúsculas y errores evidentes sin cambiar el sentido ni añadir información. Devuelve únicamente el subtítulo corregido.'});
      setStatus('error', 'No se pudo cargar la configuración');
    }
    await loadEngineStatus();
  }
  initialize();
})();
