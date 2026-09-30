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
        <p>Lo que dices se convierte en texto para tu transmisión. La transcripción no se guarda en el historial.</p>
      </div>
      <div class="mic-caption-state" id="mic-caption-state" data-state="idle" role="status" aria-live="polite">
        <i aria-hidden="true"></i><span>Comprobando servicio</span>
      </div>
    </header>

    <div class="mic-caption-layout">
      <div class="mic-caption-main">
        <article class="mic-caption-console" aria-labelledby="mic-caption-control-title">
          <div class="mic-caption-console-top">
            <div><span class="mic-caption-index">ENTRADA</span><h3 id="mic-caption-control-title">Micrófono local</h3></div>
            <span class="mic-caption-light-note">Dispositivo predeterminado de Windows</span>
          </div>
          <div class="mic-caption-meter" id="mic-caption-meter" role="meter" aria-label="Nivel del micrófono" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="mic-caption-actions">
            <button class="mic-caption-start" id="mic-caption-start" type="button" aria-pressed="false">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4m-3 7v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8"/></svg>
              <span id="mic-caption-start-label">Activar micrófono</span>
            </button>
            <div class="mic-caption-service-copy"><strong>Prueba en tiempo real</strong><span>Habla y comprueba aquí cómo saldrán los subtítulos.</span></div>
          </div>
          <p class="mic-caption-permission" id="mic-caption-permission">Comprobando el motor local de subtítulos…</p>
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
          <div><span class="mic-caption-index">DISEÑO</span><h3 id="mic-caption-settings-title">Apariencia</h3></div>
        </div>
        <form id="mic-caption-form">
          <label>Idioma
            <select id="mic-caption-language">
              <option value="es-MX">Español — México</option>
              <option value="es-US">Español — Estados Unidos</option>
              <option value="es-ES">Español — España</option>
              <option value="en-US">English — United States</option>
            </select>
          </label>
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
                <option value="system">Moderna</option>
                <option value="impact">Impacto</option>
                <option value="rounded">Redondeada</option>
                <option value="mono">Monoespaciada</option>
                <option value="serif">Elegante</option>
                <option value="handwritten">Manuscrita</option>
                <option value="condensed">Condensada</option>
                <option value="futuristic">Futurista</option>
              </select>
            </label>
            <label>Estilo del texto
              <select id="mic-caption-text-style">
                <option value="solid">Sólido</option>
                <option value="outline">Contorno</option>
                <option value="neon">Neón</option>
                <option value="label">Etiqueta</option>
              </select>
            </label>
          </div>
          <div class="mic-caption-field-row">
            <label>Sombra
              <select id="mic-caption-shadow">
                <option value="none">Sin sombra</option>
                <option value="soft">Suave</option>
                <option value="strong">Fuerte</option>
                <option value="glow">Resplandor</option>
              </select>
            </label>
            <label>Animación al aparecer
              <select id="mic-caption-animation">
                <option value="none">Sin animación</option>
                <option value="fade">Aparecer</option>
                <option value="slide">Subir</option>
                <option value="drop">Bajar</option>
                <option value="left">Desde la izquierda</option>
                <option value="right">Desde la derecha</option>
                <option value="pop">Zoom</option>
                <option value="bounce">Rebote</option>
                <option value="flip">Giro 3D</option>
                <option value="blur">Enfoque</option>
                <option value="swing">Balanceo</option>
                <option value="typewriter">Máquina de escribir</option>
              </select>
            </label>
          </div>
          <div class="mic-caption-field-row">
            <label>Color de texto
              <input id="mic-caption-text-color" type="color" value="#ffffff">
            </label>
            <label>Color de fondo
              <input id="mic-caption-background" type="color" value="#101925">
            </label>
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
          <label>Tiempo visible después de terminar
            <span class="mic-caption-range"><input id="mic-caption-duration" type="range" min="2" max="20" value="5"><output id="mic-caption-duration-output">5 s</output></span>
            <small class="mic-caption-duration-help">El conteo comienza cuando haces una pausa y la frase queda completa.</small>
          </label>
          <label class="mic-caption-check"><input id="mic-caption-transparent-background" type="checkbox"><span>Fondo transparente</span></label>
          <label class="mic-caption-check"><input id="mic-caption-pause-voice" type="checkbox" checked><span>Pausar mientras habla la voz de TikReader</span></label>
          <button class="mic-caption-save" type="submit">Guardar apariencia</button>
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
  app.append(section);

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
  const meter = $('mic-caption-meter');
  const meterBars = [...meter.querySelectorAll('span')];
  const preview = $('mic-caption-preview');
  const previewText = $('mic-caption-preview-text');
  const previewMode = $('mic-caption-preview-mode');
  const form = $('mic-caption-form');
  const duration = $('mic-caption-duration');
  const durationOutput = $('mic-caption-duration-output');
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
  let previewWordTimer = 0;
  let previewWordQueue = [];
  let previewWords = [];
  let previewWasInterim = false;

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

  function localEndpoint(parameters = {}) {
    const query = new URLSearchParams({language: recognitionLanguage(), ...parameters});
    return `/microphone-captions/audio?${query}`;
  }

  function setStatus(kind, message) {
    status.dataset.state = kind;
    status.querySelector('span').textContent = message;
  }

  function setMeterLevel(samples) {
    let level = 0;
    if (samples && samples.length) {
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      level = Math.min(1, Math.sqrt(energy / samples.length) * 7);
    }
    meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
    section.classList.toggle('has-live-meter', Boolean(samples));
    meterBars.forEach((bar, index) => {
      const shape = .58 + ((index * 7) % 5) * .12;
      bar.style.setProperty('--bar-level', String(.65 + level * (3.8 + shape)));
    });
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
      pause_during_voice: $('mic-caption-pause-voice').checked
    };
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
    try { await update({text: clean, interim: false}); }
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
          handleLocalResult({...payload, final: false});
        }
      }
    } catch (_) {}
    running = false;
    if (!preserveIntent) {
      desired = false;
      setStatus('ready', 'Servicio listo');
      permission.textContent = 'El servicio sigue preparado. Activa el micrófono cuando quieras volver a usarlo.';
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
      localStream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
      localContext = new LocalAudioContext();
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
      running = true;
      setStatus('live', 'Micrófono activo');
      permission.textContent = 'Habla con naturalidad. Puedes comprobar el texto aquí y en el overlay.';
      update({listening: true}).catch(() => {});
      syncButtons();
    } catch (error) {
      teardownLocalAudio();
      desired = false;
      setStatus('error', 'No se pudo iniciar el micrófono');
      permission.textContent = error.message;
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
      setStatus('ready', 'Servicio listo');
      permission.textContent = 'El servicio sigue preparado. Activa el micrófono cuando quieras volver a usarlo.';
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
        setStatus('live', 'Micrófono activo');
        permission.textContent = 'Habla con naturalidad. Puedes comprobar el texto aquí y en el overlay.';
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
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setStatus('error', 'No se pudo reconocer la voz');
        }
        syncButtons();
      };
      recognition.onend = () => {
        running = false;
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
    setStatus('waiting', 'Activando micrófono');
    permission.textContent = 'Windows puede pedir permiso la primera vez. No se guarda el audio.';
    syncButtons();
    beginRecognition();
  });

  duration.addEventListener('input', () => {
    durationOutput.value = `${duration.value} s`;
    durationOutput.textContent = `${duration.value} s`;
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
      const state = await update({settings: readSettings()});
      applySettings(state.settings);
      output.textContent = 'Apariencia guardada.';
      setTimeout(() => { if (output.textContent === 'Apariencia guardada.') output.textContent = ''; }, 2500);
    } catch (error) { output.textContent = error.message; }
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
    if (!useLocalRecognition) {
      if (recognitionSupported) {
        setStatus('ready', 'Servicio listo');
        permission.textContent = 'Activa el micrófono para comprobar los subtítulos en tiempo real.';
      }
      syncButtons();
      return;
    }
    try {
      const response = await fetch(`/microphone-captions/engine?language=${encodeURIComponent(recognitionLanguage())}`);
      const engine = await response.json();
      localEngineReady = Boolean(response.ok && engine.available);
      if (localEngineReady) {
        setStatus('ready', 'Español (México) listo');
        permission.textContent = 'El motor local en español está preparado. Activa el micrófono para probarlo en tiempo real.';
      } else {
        setStatus('error', 'Servicio local no disponible');
        permission.textContent = engine.error || (engine.model_ready ? 'Falta instalar el motor de subtítulos.' : 'Falta el modelo local de español.');
      }
    } catch (_) {
      localEngineReady = false;
      setStatus('error', 'No se pudo comprobar el servicio');
      permission.textContent = 'Reinicia TikReader y vuelve a abrir esta sección.';
    }
    syncButtons();
  }

  syncButtons();
  loadEngineStatus();

  fetch('/microphone-captions/state')
    .then(response => response.json())
    .then(state => {
      applySettings(state.settings);
      if (state.text) showPreview(state.text, state.interim);
    })
    .catch(() => {
      applySettings({language:'es-MX', duration:5, position:'bottom', font_size:48, text_color:'#ffffff', background:'#101925', show_background:true, pause_during_voice:true, font_family:'system', text_style:'solid', shadow:'soft', animation:'fade'});
      setStatus('error', 'No se pudo cargar la configuración');
    });
})();
