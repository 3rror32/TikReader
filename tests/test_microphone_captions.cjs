const assert = require('assert');
const fs = require('fs');

const controls = fs.readFileSync('web/static/microphone_captions.js', 'utf8');
const controlsCss = fs.readFileSync('web/static/microphone_captions.css', 'utf8');
const widget = fs.readFileSync('web/static/microphone_caption_widget.js', 'utf8');
const widgetCss = fs.readFileSync('web/static/microphone_caption_widget.css', 'utf8');
const shell = fs.readFileSync('web/static/shell.js', 'utf8');
const sidebar = fs.readFileSync('web/static/sidebar.js', 'utf8');

assert.match(controls, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
assert.match(controls, /no guarda el audio ni añade la transcripción al historial/);
assert.match(controls, /Activar micrófono/);
assert.match(controls, /Detener micrófono/);
assert.match(controls, /Idioma de reconocimiento/);
assert.match(controls, /function syncLanguageInterface\(\)/);
assert.match(controls, /Escuchando en \$\{selectedLanguageDetails\(\)\.label\}/);
assert.match(controls, /las opciones en español comparten el mismo motor local/);
assert.match(controls, /mic-caption-header-controls[\s\S]*mic-caption-start[\s\S]*mic-caption-state/);
assert.doesNotMatch(controls, /Probar mi voz|Iniciar micrófono/);
assert.match(controls, /window\.qt && window\.qt\.webChannelTransport/);
assert.match(controls, /QtWebEngine/);
assert.match(controls, /if \(useLocalRecognition\) \{\s*beginLocalRecognition\(\)/);
assert.match(controls, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
assert.match(controls, /setMeterLevel\(samples\)/);
assert.match(controls, /smoothedMeterLevel/);
assert.match(controls, /Señal baja/);
assert.match(controls, /Volumen alto/);
assert.match(controls, /Recibiendo voz/);
assert.match(controls, /Máquina de escribir/);
assert.match(controls, /mic-caption-font/);
assert.match(controls, /Repetir animación/);
assert.match(controls, /data-text-color=/);
assert.match(controls, /Fondo transparente/);
assert.match(controls, /show_background: !\$\('mic-caption-transparent-background'\)\.checked/);
assert.match(controls, /Giro 3D/);
assert.match(controls, /Futurista/);
assert.match(controls, /navigator\.mediaDevices/);
assert.match(controls, /mic-caption-noise-suppression/);
assert.match(controls, /mic-caption-echo-cancellation/);
assert.match(controls, /mic-caption-auto-gain/);
assert.match(controls, /audioProcessingConstraints\(source = settings \|\| \{\}\)/);
assert.match(controls, /getUserMedia\(\{audio:\{channelCount:1, \.\.\.audioProcessingConstraints\(\)\}\}\)/);
assert.match(controls, /track\.applyConstraints\(audioProcessingConstraints\(next\)\)/);
assert.match(controls, /update\(\{settings: next\}\)/);
assert.match(controls, /settings = \{\.\.\.settings, \.\.\.audioProcessingSettings\(state\.settings\)\}/);
assert.match(controls, /El servicio de voz del navegador controla estas mejoras/);
assert.match(controlsCss, /mic-caption-processing-toggle:has\(input:checked\)/);
assert.match(controlsCss, /--mic-surface:\s*var\(--skin-surface/);
assert.match(controlsCss, /--mic-accent:\s*var\(--skin-accent/);
assert.match(controlsCss, /--mic-radius:\s*var\(--control-field-radius/);
assert.match(controlsCss, /background:\s*var\(--mic-surface\)/);
assert.match(controlsCss, /background-color:\s*var\(--mic-bg\)/);
assert.doesNotMatch(controlsCss, /--mic-accent-rgb/);
assert.match(controls, /function microphoneErrorMessage\(error\)/);
assert.match(controls, /NotAllowedError/);
assert.match(controls, /NotFoundError/);
assert.match(controls, /NotReadableError/);
assert.match(controls, /localContext\.state === 'suspended'[\s\S]*localContext\.resume\(\)/);
assert.match(controls, /track\.addEventListener\('ended'/);
assert.match(controls, /event\.error === 'audio-capture'/);
assert.match(controls, /event\.error === 'network'/);
assert.match(controls, /\/microphone-captions\/audio/);
assert.match(controls, /URLSearchParams\(\{language: recognitionLanguage\(\)/);
assert.match(controls, /recognition\.lang = recognitionLanguage\(\)/);
assert.match(controls, /mic-caption-language[\s\S]*stopLocalRecognition\(true\)/);
assert.doesNotMatch(controls, /Google Chrome|Microsoft Edge|Ligero y privado|FUENTE PARA OBS/);
assert.doesNotMatch(controls, /Navegador no compatible/);
assert.match(controls, /\/widget\/microphone-captions/);
assert.doesNotMatch(controls, /localStorage.*transcript/i);
assert.match(widget, /microphone_caption/);
assert.match(widget, /span\.className = 'microphone-caption-word'/);
assert.match(widget, /commonPrefixLength\(renderedWords, words\)/);
assert.match(widget, /if \(!interim\) \{[\s\S]*visibleUntil/);
assert.doesNotMatch(widget, /WORD_INTERVAL|wordQueue|queueTranscript/);
assert.match(controls, /span\.className = 'mic-caption-word'/);
assert.match(controls, /commonPrefixLength\(previewWords, words\)/);
assert.match(controls, /FORMANDO FRASE…/);
assert.match(controls, /Tiempo visible después de terminar/);
assert.match(controls, /Mejorar con IA externa/);
assert.match(controls, /Solo se envía el texto/);
assert.match(controls, /mic-caption-ai-enabled/);
const aiSettingsMarkup = controls.match(/<section class="mic-caption-ai-settings"[\s\S]*?<\/section>/)?.[0] || '';
assert(aiSettingsMarkup, 'AI settings should have a visible section outside the advanced disclosure');
assert.doesNotMatch(aiSettingsMarkup, /<\/?details\b/);
assert.match(controls, /mic-caption-signal-path[\s\S]*?<section class="mic-caption-ai-settings"[\s\S]*?mic-caption-ai-enabled[\s\S]*?mic-caption-ai-fields[\s\S]*?<\/section>[\s\S]*?<section class="mic-caption-form-section" aria-labelledby="mic-caption-content-title"/);
assert.match(aiSettingsMarkup, /id="mic-caption-ai-fields" hidden/);
assert.match(controls, /aiFields\.hidden = !enabled/);
assert.match(controls, /Probar conexión/);
assert.match(controls, /\/microphone-captions\/ai\/refine/);
assert.match(controls, /Clave protegida/);
assert.match(controlsCss, /mic-caption-signal-path/);
assert.match(controlsCss, /mic-caption-header-controls/);
assert.match(controlsCss, /mic-caption-language-summary/);
assert.match(controlsCss, /mic-caption-ai-settings\.has-active-ai/);
assert.match(controls, /async function initialize\(\)[\s\S]*fetch\('\/microphone-captions\/state'\)[\s\S]*applySettings\(state\.settings\)[\s\S]*await loadEngineStatus\(\)/);
assert.match(controls, /const checkId = \+\+engineCheckId;[\s\S]*checkId !== engineCheckId/);
assert.doesNotMatch(controls, /PALABRA EN VIVO/);
assert.match(widgetCss, /data-animation="typewriter"[\s\S]*microphone-caption-word\.is-new/);
assert.match(controlsCss, /mic-caption-meter\[data-signal="high"\]/);
assert.match(controlsCss, /prefers-reduced-motion[\s\S]*data-animation="bounce"[\s\S]*animation: mic-caption-preview-bounce[^;]+!important/);
assert.match(widgetCss, /prefers-reduced-motion[\s\S]*data-animation="bounce"[\s\S]*animation: microphone-caption-bounce[^;]+!important/);
assert.match(shell, /"Subtítulos"[\s\S]*"microphone-captions"/);
assert.match(sidebar, /basicDestinations[\s\S]*'microphone-captions'/);

{
  const vm = require('vm');
  class ClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    toggle(name, force) {
      if (force === undefined) force = !this.values.has(name);
      if (force) this.values.add(name); else this.values.delete(name);
      return force;
    }
    contains(name) { return this.values.has(name); }
  }
  const makeElement = () => ({
    children: [], dataset: {}, classList: new ClassList(),
    style: {setProperty() {}},
    append(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; },
  });
  const stage = makeElement();
  const text = makeElement();
  let renderWidget;
  const scheduled = [];
  vm.runInNewContext(widget, {
    document: {
      getElementById: id => id === 'microphone-caption-stage' ? stage : text,
      createElement: makeElement,
      createTextNode: value => ({textContent: value}),
      documentElement: {style: {setProperty() {}}},
    },
    io: () => ({on: (name, callback) => { if (name === 'microphone_caption') renderWidget = callback; }}),
    fetch: async () => ({ok: false}),
    setInterval() {},
    setTimeout: (callback, delay) => { scheduled.push({callback, delay}); return scheduled.length; },
    clearTimeout() {},
    Date,
    Array,
    Boolean,
    Math,
    Number,
    String,
  });
  const settings = {animation: 'fade', duration: 5};
  renderWidget({revision: 1, text: 'Esto', interim: true, visible_until: 0, settings});
  assert.equal(text.children[0].textContent, 'Esto');
  assert.equal(text.children[0].classList.contains('is-new'), true);
  assert.equal(scheduled.length, 0, 'provisional text must not start the visible timer');

  renderWidget({revision: 2, text: 'Esto es', interim: true, visible_until: 0, settings});
  assert.equal(text.children[0].classList.contains('is-new'), false);
  assert.equal(text.children[2].textContent, 'es');
  assert.equal(text.children[2].classList.contains('is-new'), true);

  renderWidget({revision: 3, text: 'Esto es', interim: false, visible_until: Date.now() / 1000 + 5, settings});
  assert.equal(text.children[0].classList.contains('is-new'), false);
  assert.equal(text.children[2].classList.contains('is-new'), false);
  assert.equal(scheduled.length, 1, 'the visible timer starts after the final phrase');
}

console.log('microphone captions frontend checks passed');
