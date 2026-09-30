const assert = require('assert');
const fs = require('fs');

const controls = fs.readFileSync('web/static/microphone_captions.js', 'utf8');
const controlsCss = fs.readFileSync('web/static/microphone_captions.css', 'utf8');
const widget = fs.readFileSync('web/static/microphone_caption_widget.js', 'utf8');
const widgetCss = fs.readFileSync('web/static/microphone_caption_widget.css', 'utf8');
const shell = fs.readFileSync('web/static/shell.js', 'utf8');
const sidebar = fs.readFileSync('web/static/sidebar.js', 'utf8');

assert.match(controls, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
assert.match(controls, /La transcripción no se guarda/);
assert.match(controls, /Activar micrófono/);
assert.match(controls, /Detener micrófono/);
assert.doesNotMatch(controls, /Probar mi voz|Iniciar micrófono/);
assert.match(controls, /window\.qt && window\.qt\.webChannelTransport/);
assert.match(controls, /QtWebEngine/);
assert.match(controls, /if \(useLocalRecognition\) \{\s*beginLocalRecognition\(\)/);
assert.match(controls, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
assert.match(controls, /setMeterLevel\(samples\)/);
assert.match(controls, /Máquina de escribir/);
assert.match(controls, /mic-caption-font/);
assert.match(controls, /Repetir animación/);
assert.match(controls, /data-text-color=/);
assert.match(controls, /Fondo transparente/);
assert.match(controls, /show_background: !\$\('mic-caption-transparent-background'\)\.checked/);
assert.match(controls, /Giro 3D/);
assert.match(controls, /Futurista/);
assert.match(controls, /navigator\.mediaDevices/);
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
assert.doesNotMatch(controls, /PALABRA EN VIVO/);
assert.match(widgetCss, /data-animation="typewriter"[\s\S]*microphone-caption-word\.is-new/);
assert.match(controlsCss, /prefers-reduced-motion[\s\S]*data-animation="bounce"[\s\S]*animation: mic-caption-preview-bounce[^;]+!important/);
assert.match(widgetCss, /prefers-reduced-motion[\s\S]*data-animation="bounce"[\s\S]*animation: microphone-caption-bounce[^;]+!important/);
assert.match(shell, /"Subtítulos del micrófono"[\s\S]*"microphone-captions"/);
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
