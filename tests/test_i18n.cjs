process.chdir(require('node:path').resolve(__dirname, '..'));
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Small DOM fixture: exercises real localization code without external packages.
class Element {
  constructor(tag, text = '', attrs = {}) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {...attrs};
    this.childNodes = []; this.isConnected = true;
    if (text) this.appendText(text);
  }
  appendText(text) {
    const node = {nodeType: 3, nodeValue: text, parentElement: this, isConnected: true};
    this.childNodes.push(node); return node;
  }
  append(node) { node.parentElement = this; this.childNodes.push(node); }
  get textContent() { return this.childNodes.map(n => n.nodeType === 3 ? n.nodeValue : n.textContent).join(''); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  get value() { return this.getAttribute('value') ?? this.textContent; }
  set value(value) { this.setAttribute('value', value); }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (selector.split(',').includes(node.tagName.toLowerCase()) || node.attrs.translate === 'no'
        || node.attrs['data-i18n-ignore'] !== undefined || node.attrs.class === 'comment-text') return node;
    }
    return null;
  }
}

function setup(saved, unavailable = false) {
  const body = new Element('body'), title = new Element('title', 'TikReader — Estudio en vivo');
  const html = new Element('html'); html.append(body);
  const ready = [], listeners = {}, observers = [], storage = new Map();
  if (saved !== undefined) storage.set('tikreader.locale', saved);
  const document = {body, documentElement: html, readyState: 'loading',
    addEventListener(_, cb) { ready.push(cb); },
    querySelector(selector) { return selector === 'title' ? title : null; },
    querySelectorAll() { return []; },
  };
  const window = {addEventListener(name, cb) { listeners[name] = cb; }, dispatchEvent() {}};
  const context = vm.createContext({window, document,
    localStorage: {
      getItem(key) { if (unavailable) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (unavailable) throw Error('blocked'); storage.set(key, value); },
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    MutationObserver: class { constructor(cb) { observers.push(cb); } observe() {} },
  });
  for (const file of ['translations.js', 'i18n.js']) vm.runInContext(fs.readFileSync(`${__dirname}/../web/static/${file}`, 'utf8'), context);
  return {body, title, html, window, storage, start: () => ready.forEach(cb => cb()),
    mutate: node => observers.forEach(cb => cb([{type:'characterData', target:node}])),
    added: node => observers.forEach(cb => cb([{type:'childList', addedNodes:[node]}])),
    sync: value => listeners.storage({key:'tikreader.locale', newValue:value}),
  };
}

test('Latin American Spanish is default regardless of browser language; invalid storage falls back', () => {
  for (const saved of [undefined, 'de', '', '__proto__']) {
    const app = setup(saved); app.start();
    assert.equal(app.window.I18n.locale, 'es-419');
    assert.equal(app.html.lang, 'es-419');
    assert.equal(app.window.I18n.t('Guardar'), 'Guardar');
  }
});

test('operator recovery and pending telemetry copy translate consistently', () => {
  const app = setup(); app.start();
  for (const [source, en, fr] of [
    ['Centro de control', 'Control center', 'Centre de contrôle'],
    ['Conexión cancelada', 'Connection cancelled', 'Connexion annulée'],
    ['No se pudo conectar', 'Could not connect', 'Impossible de se connecter'],
    ['Revisar usuario', 'Review username', 'Vérifier le nom d’utilisateur'],
    ['Reintentar conexión', 'Retry connection', 'Réessayer la connexion'],
    ['Esperando datos de TikTok', 'Waiting for TikTok data', 'En attente de données TikTok'],
  ]) {
    app.window.I18n.setLocale('en'); assert.equal(app.window.I18n.t(source), en);
    app.window.I18n.setLocale('fr'); assert.equal(app.window.I18n.t(source), fr);
    app.window.I18n.setLocale('es-419'); assert.equal(app.window.I18n.t(source), source);
  }
});

test('switches es → en → fr → es without losing original labels, attributes or child elements', () => {
  const app = setup(), button = new Element('button', ' Guardar ', {title:'Guardar perfil'});
  const icon = new Element('svg'); button.append(icon); app.body.append(button); app.start();
  for (const [locale, text, title] of [['en',' Save ','Save profile'],['fr',' Enregistrer ','Enregistrer le profil'],['es-419',' Guardar ','Guardar perfil']]) {
    app.window.I18n.setLocale(locale);
    assert.equal(button.textContent, text); assert.equal(button.getAttribute('title'), title);
    assert.equal(button.childNodes[1], icon); assert.equal(app.storage.get('tikreader.locale'), locale);
    assert.equal(app.window.I18n.sourceText(button), ' Guardar ');
  }
});

test('dynamic replacement, new controls and numeric statuses use current locale', () => {
  const app = setup('en'), status = new Element('p','Voz apagada · cola: 0');
  app.body.append(status); app.start();
  assert.equal(status.textContent, 'Voice off · queue: 0');
  status.childNodes[0].nodeValue = 'Voz activa · cola: 3'; app.mutate(status.childNodes[0]);
  assert.equal(status.textContent, 'Voice active · queue: 3');
  const button = new Element('button', 'Continuar'); app.body.append(button); app.added(button);
  assert.equal(button.textContent, 'Continue');
  app.window.I18n.setLocale('fr'); assert.equal(status.textContent, 'Voix active · file: 3');
  assert.equal(app.window.I18n.t('{count} lecturas omitidas', {count:12}), '12 lectures ignorées');
});

test('viewer messages, editable content, code and explicit opt-outs remain untouched', () => {
  const app = setup('en');
  const nodes = [new Element('p','Guardar',{class:'comment-text'}), new Element('p','Guardar',{translate:'no'}),
    new Element('textarea','Guardar'),new Element('code','Guardar'),new Element('p','Guardar',{'data-i18n-ignore':''})];
  nodes.forEach(node => app.body.append(node)); app.start();
  assert.ok(nodes.every(node => node.textContent === 'Guardar'));
  app.window.I18n.setLocale('fr'); assert.ok(nodes.every(node => node.textContent === 'Guardar'));
});

test('paused button visible and accessible labels stay localized through state and locale changes', () => {
  const app = setup('en'), button = new Element('button','Pausar voz y efectos', {'aria-label':'Pausar voz y efectos'});
  app.body.append(button); app.start();
  button.childNodes[0].nodeValue = 'En pausa · Reanudar';
  button.setAttribute('aria-label','En pausa · Reanudar');
  app.mutate(button.childNodes[0]); app.added(button);
  for (const [locale, label] of [['en','Paused · Resume'],['fr','En pause · Reprendre'],['es-419','En pausa · Reanudar']]) {
    app.window.I18n.setLocale(locale);
    assert.equal(button.textContent,label);
    assert.equal(button.getAttribute('aria-label'),label);
  }
  app.window.I18n.setLocale('en');
  button.childNodes[0].nodeValue = 'Pausar voz y efectos';
  button.setAttribute('aria-label','Pausar voz y efectos');
  app.mutate(button.childNodes[0]); app.added(button);
  assert.equal(button.textContent,'Pause voice and effects');
  assert.equal(button.getAttribute('aria-label'),button.textContent);
});

test('option labels translate without changing implicit values sent to application code', () => {
  const app = setup('fr'), option = new Element('option','Guardar'); app.body.append(option); app.start();
  assert.equal(option.textContent,'Enregistrer'); assert.equal(option.value,'Guardar');
  app.window.I18n.setLocale('en'); assert.equal(option.textContent,'Save'); assert.equal(option.value,'Guardar');
});

test('restores stored locale, syncs tabs, tolerates blocked storage and missing translations', () => {
  const app = setup('fr'); app.start(); assert.equal(app.title.textContent,'TikReader — Studio en direct');
  app.sync('en'); assert.equal(app.title.textContent,'TikReader — Live studio');
  app.sync(null); assert.equal(app.html.lang,'es-419');
  const blocked = setup(undefined,true); blocked.start(); blocked.window.I18n.setLocale('fr');
  assert.equal(blocked.window.I18n.t('Unknown text'), 'Unknown text');
  assert.equal(blocked.window.I18n.t('Guardar'), 'Enregistrer');
});

test('catalogs have matching keys, valid translations and identical interpolation parameters', () => {
  const {window} = setup(); const {en,fr} = window.TikReaderTranslations;
  assert.deepEqual(Object.keys(en),Object.keys(fr)); assert.ok(Object.keys(en).length > 900);
  const parameters = text => [...text.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
  for (const [key, value] of Object.entries(en)) {
    assert.equal(typeof value,'string',key); assert.ok(value.trim(),key); assert.ok(fr[key]?.trim(),key);
    assert.deepEqual(parameters(key),parameters(value),key); assert.deepEqual(parameters(key),parameters(fr[key]),key);
  }
});
