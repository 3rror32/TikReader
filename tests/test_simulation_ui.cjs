const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.style = {setProperty() {}, removeProperty() {}};
    this.classList = {add() {}, remove() {}, toggle() {}};
    this.hidden = false;
    this.scrollHeight = 100;
    this.scrollTop = 0;
    this.clientHeight = 100;
    this.value = '';
    this.textContent = '';
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { for (const node of nodes) node.parentNode = this; this.children.push(...nodes); }
  prepend(...nodes) { for (const node of nodes) node.parentNode = this; this.children.unshift(...nodes); }
  replaceChildren(...nodes) { for (const node of nodes) node.parentNode = this; this.children = [...nodes]; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  dispatch(name, event = {}) {
    const dispatched = {target: this, preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }, ...event};
    if (name === 'click' && this.tagName === 'BUTTON') this.focus();
    if (name === 'click' && typeof this.onclick === 'function') this.onclick(dispatched);
    for (let current = this; current; current = current.parentNode) {
      for (const listener of current.listeners[name] || []) listener(dispatched);
      if (dispatched.propagationStopped) break;
    }
    return dispatched;
  }
  removeAttribute(name) { delete this.attributes[name]; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = selector.match(/\[[^\]]+\]/g) || [];
    return descendants(this).filter(node => {
      if (selector.includes('option') && node.getAttribute('role') !== 'option') return false;
      return selectors.every(attribute => {
        const [, name, value] = attribute.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || [];
        return name && node.getAttribute(name) !== null && (value === undefined || node.getAttribute(name) === value);
      });
    });
  }
  getBoundingClientRect() { return {left: 20, top: 100, bottom: 134, width: 180}; }
  focus() { this.focused = true; if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  select() {}
  set innerHTML(value) {
    this._innerHTML = value;
    if (this.id !== 'simulation-float' || !this.ownerDocument) return;
    this.children = [];
    for (const match of value.matchAll(/<(button|div)\b([^>]*role="(?:tab|tabpanel)"[^>]*)>/g)) {
      const node = this.ownerDocument.createElement(match[1]);
      const attributes = [...match[2].matchAll(/([\w-]+)="([^"]*)"/g)];
      for (const [, name, content] of attributes) node.setAttribute(name, content);
      node.id = node.getAttribute('id');
      node.dataset.simulationFloatTab = node.getAttribute('data-simulation-float-tab') || undefined;
      node.hidden = /\shidden(?:\s|$)/.test(match[2]);
      if (node.id) this.ownerDocument.elements.set(node.id, node);
      this.append(node);
    }
  }
  get innerHTML() { return this._innerHTML || ''; }
}

function loadSimulationUI(options = {}) {
  const elements = new Map();
  const body = new Element('body');
  const documentListeners = {};
  const document = {
    hidden: true,
    body,
    elements,
    createElement: tag => { const element = new Element(tag); element.ownerDocument = document; return element; },
    getElementById(id) {
      if (!elements.has(id)) {
        const element = document.createElement();
        element.id = id;
        if (id === 'simulation-gift' || id === 'simulation-float-gift') {
          element.tagName = 'BUTTON';
          element.dataset.giftName = 'Rose';
          element.setAttribute('role', 'combobox');
          element.setAttribute('aria-haspopup', 'listbox');
          element.setAttribute('aria-expanded', 'false');
        }
        elements.set(id, element);
      }
      return elements.get(id);
    },
    querySelector: () => new Element(),
    querySelectorAll: () => [],
    addEventListener(name, listener) { (documentListeners[name] ||= []).push(listener); },
    dispatch(name, event = {}) { for (const listener of documentListeners[name] || []) listener(event); },
  };
  body.ownerDocument = document;
  const window = {addEventListener() {}};
  const requests = [];
  const defaultCatalog = {gifts: [
    {id: 'heart-ten', name: 'Heart', diamonds: 10, image_url: 'https://example.test/heart.png'},
    {id: 'rose-one', name: 'Rose', diamonds: 1, image_url: 'https://example.test/rose.png'},
    {id: 'rose-five', name: 'Rose', diamonds: 5, image_url: 'https://example.test/rose-five.png'},
  ]};
  const catalogResponses = options.giftCatalogResponses || [defaultCatalog];
  let catalogRequest = 0;
  const sandbox = {
    window,
    document,
    Element,
    ResizeObserver: class { observe() {} },
    AbortSignal,
    fetch: async (url, options = {}) => {
      requests.push({url, options});
      if (url === '/gift-catalog') {
        const response = catalogResponses[Math.min(catalogRequest++, catalogResponses.length - 1)];
        if (response instanceof Error) throw response;
        return {ok: response?.ok !== false, json: async () => response?.body ?? response};
      }
      return {ok: true, json: async () => ({active: true, generation: 1, instance: 'ui-test'})};
    },
    setInterval() {},
    addEventListener() {},
    matchMedia: () => ({matches: false}),
    requestAnimationFrame: callback => callback(),
    sessionStorage: {getItem: () => null, setItem() {}},
    localStorage: {getItem: () => null, setItem() {}},
    innerWidth: 1200,
    innerHeight: 800,
    console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8'), sandbox);
  return {ui: window.SimulationUI, elements, requests, body, document};
}

test('rapid sends retain form snapshots and stay enabled during batches', async () => {
  const {ui,elements,requests,document}=loadSimulationUI();
  await new Promise(resolve=>setImmediate(resolve));
  ui.apply({active:true,generation:1,instance:'ui-test',batch:{running:true}});
  assert.equal(elements.get('simulation-fields').disabled,false);
  assert.equal(elements.get('simulation-float-fields').disabled,false);
  const input=document.getElementById('simulation-text');
  input.value='First';elements.get('simulation-form').onsubmit({preventDefault(){}});
  input.value='Second';elements.get('simulation-form').onsubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests.filter(item=>item.url==='/simulation/events').map(item=>JSON.parse(item.options.body).text),['First','Second']);
});

function renderGift(event) {
  const {ui, elements} = loadSimulationUI();
  ui.apply({
    active: true,
    instance: 'ui-test',
    generation: 1,
    events: [event],
    games: {profile: 'General', authorized: true, paused: false, mappings: [], log: []},
    traces: [],
  });
  return elements.get('simulation-float-feed').children[0];
}

function descendants(node) {
  return node.children.flatMap(child => [child, ...descendants(child)]);
}

test('simulated gift shows its catalog image and visible quantity with an accessible name', () => {
  const row = renderGift({id: 'gift-1', at: 1, user: '@Ana', kind: 'gift', gift: 'Rose',
    count: 3, image_url: 'https://example.test/rose.png', text: 'Rose × 3'});
  const nodes = descendants(row);
  const image = nodes.find(node => node.tagName === 'IMG');
  assert.ok(image, 'catalog-backed gift should render an image');
  assert.equal(image.src, 'https://example.test/rose.png');
  assert.ok(nodes.some(node => node.textContent.includes('3')), 'quantity should remain visible');
  assert.match(row.getAttribute('aria-label') || '', /Rose.*3|3.*Rose/);
});

test('simulated gift without an image has a stable name fallback and visible quantity', () => {
  const row = renderGift({id: 'gift-2', at: 1, user: '@Ana', kind: 'gift', gift: 'Rose',
    count: 2, image_url: null, text: 'Rose × 2'});
  const nodes = descendants(row);
  assert.ok(nodes.some(node => node.textContent === 'Rose'), 'gift name should be the fallback');
  assert.ok(nodes.some(node => node.textContent.includes('2')), 'quantity should remain visible');
});

test('failed simulated gift image switches to the stable name fallback', () => {
  const row = renderGift({id: 'gift-3', at: 1, user: '@Ana', kind: 'gift', gift: 'Rose',
    count: 1, image_url: 'https://example.test/rose.png', text: 'Rose × 1'});
  const nodes = descendants(row);
  const image = nodes.find(node => node.tagName === 'IMG');
  assert.ok(image, 'catalog-backed gift should render an image');
  image.onerror();
  const afterError = descendants(row);
  assert.ok(!afterError.some(node => node.tagName === 'IMG'), 'failed image should be removed');
  assert.ok(afterError.some(node => node.textContent === 'Rose'), 'gift name should replace failed image');
  assert.ok(afterError.some(node => node.textContent.includes('1')), 'quantity should remain visible');
});

test('main and floating gift controls are button comboboxes instead of editable text inputs', () => {
  const template = fs.readFileSync(path.join(__dirname, '../web/templates/simulation.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8');
  assert.match(template, /<button\b[^>]*id="simulation-gift"[^>]*role="combobox"/,
    'main gift control should be a button-style combobox');
  assert.match(script, /<button\s+id="simulation-float-gift"[^>]*role="combobox"/,
    'floating gift control should be a button-style combobox');
  assert.doesNotMatch(template, /<input\b[^>]*id="simulation-gift"/,
    'main gift control should not be an editable text field');
  assert.doesNotMatch(script, /<input\s+id="simulation-float-gift"/,
    'floating gift control should not be an editable text field');
});

test('floating send control keeps concise visible copy and event-specific accessible names', () => {
  const script = fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../web/static/simulation.css'), 'utf8');
  assert.match(script, /<div class="simulation-float-send-row"><label><span>Espera<\/span><span class="simulation-float-number"><input id="simulation-float-delay"[\s\S]*?<\/label><button id="simulation-float-send" type="submit" aria-label="Enviar comentario">/,
    'delay heading and input stay grouped beside the send button');
  assert.match(script, /<button id="simulation-float-send"[\s\S]*?<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<span>Enviar<\/span><\/button>/,
    'the send icon is hidden from assistive technology and visible copy stays fixed');
  assert.match(script, /simulation-float-send'\)\.setAttribute\('aria-label',gift\?'Enviar regalo':'Enviar comentario'\)/,
    'the accessible action name follows the selected event');
  assert.match(styles, /\.simulation-float-send-row\{display:grid;grid-template-columns:76px minmax\(0,1fr\);align-items:end;/,
    'the row places the button at the delay field row bottom');
  assert.match(styles, /#simulation-float-form \.simulation-float-send-row>label\{margin:0\}/,
    'the row-specific selector clears the form label bottom margin');
  assert.match(styles, /#simulation-float :is\(input,select\)\{height:34px;/,
    'the delay input keeps its shared control height');
  assert.match(styles, /#simulation-float-send\{display:inline-flex;flex:1;height:34px;/,
    'the send button uses the same control height');
});

test('floating panel tabs navigate, activate panels, and restore focus', () => {
  const {ui, elements, body, document} = loadSimulationUI();
  const dock = body.children.find(node => node.id === 'simulation-float');
  const tabs = dock.querySelectorAll('[data-simulation-float-tab]');
  const chat = tabs.find(tab => tab.dataset.simulationFloatTab === 'chat');
  const activity = tabs.find(tab => tab.dataset.simulationFloatTab === 'activity');
  const chatPanel = elements.get('simulation-float-chat-view');
  const activityPanel = elements.get('simulation-float-activity-view');
  const assertSelected = (selected, otherTab, shownPanel, hiddenPanel) => {
    assert.equal(selected.getAttribute('aria-selected'), 'true');
    assert.equal(selected.getAttribute('tabindex'), '0');
    assert.equal(otherTab.getAttribute('aria-selected'), 'false');
    assert.equal(otherTab.getAttribute('tabindex'), '-1');
    assert.equal(shownPanel.hidden, false);
    assert.equal(hiddenPanel.hidden, true);
  };

  ui.open();
  const launcher = body.children.find(node => node.id === 'simulation-fab');
  assert.equal(document.activeElement, chat, 'opening focuses the selected Chat tab');
  assertSelected(chat, activity, chatPanel, activityPanel);

  activity.dispatch('click');
  assertSelected(activity, chat, activityPanel, chatPanel);
  assert.equal(document.activeElement, activity, 'mouse activation focuses the activated tab');

  activity.dispatch('keydown', {key: 'ArrowRight'});
  assertSelected(chat, activity, chatPanel, activityPanel);
  assert.equal(document.activeElement, chat, 'ArrowRight wraps to the next tab and focuses it');
  chat.dispatch('keydown', {key: 'ArrowLeft'});
  assertSelected(activity, chat, activityPanel, chatPanel);
  assert.equal(document.activeElement, activity, 'ArrowLeft wraps to the previous tab and focuses it');
  chat.dispatch('keydown', {key: 'Home'});
  assertSelected(chat, activity, chatPanel, activityPanel);
  chat.dispatch('keydown', {key: 'End'});
  assertSelected(activity, chat, activityPanel, chatPanel);

  elements.get('simulation-float-close').onclick();
  assert.equal(document.activeElement, launcher, 'the close button restores focus to the launcher');
  ui.open();
  document.dispatch('keydown', {key: 'Escape', defaultPrevented: false});
  assert.equal(document.activeElement, launcher, 'Escape restores focus to the launcher');
});

test('real-effect scope stays visible beside both simulation send controls', () => {
  const template = fs.readFileSync(path.join(__dirname, '../web/templates/simulation.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8');
  assert.match(template, /<p id="simulation-effects-cue" class="simulation-effects-cue"[^>]*>[^<]+<\/p>[\s\S]*?<button id="simulation-send"/,
    'the full-page cue appears beside its send control');
  assert.match(script, /<p id="simulation-float-effects-cue" class="simulation-effects-cue"[^>]*>[^<]+<\/p>[\s\S]*?<button id="simulation-float-send"/,
    'the floating-panel cue appears beside its send control');

  const {ui, elements} = loadSimulationUI();
  ui.apply({active:false,generation:1,instance:'ui-test'});
  assert.equal(elements.get('simulation-effects-cue').textContent,
    'Al activar, cada envío ejecuta tus reglas guardadas y los overlays habituales.');
  assert.equal(elements.get('simulation-float-effects-cue').textContent,
    'Al activar, cada envío ejecuta tus reglas guardadas y los overlays habituales.');
  ui.apply({active:true,generation:1,instance:'ui-test'});
  assert.equal(elements.get('simulation-effects-cue').textContent,
    'Simulación activa: al enviar, tus reglas guardadas y los overlays habituales ejecutan acciones reales.');
  assert.equal(elements.get('simulation-float-effects-cue').textContent,
    'Simulación activa: al enviar, tus reglas guardadas y los overlays habituales ejecutan acciones reales.');
  ui.apply({active:true,muted:true,generation:1,instance:'ui-test'});
  assert.equal(elements.get('simulation-effects-cue').textContent,
    'Simulación activa: las acciones están pausadas.');
  assert.equal(elements.get('simulation-float-effects-cue').textContent,
    'Simulación activa: las acciones están pausadas.');
});

test('gift catalog failure explains the problem and retry restores selection without reload', async () => {
  const template = fs.readFileSync(path.join(__dirname, '../web/templates/simulation.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8');
  for (const id of ['simulation-gift-catalog-error', 'simulation-gift-catalog-retry']) {
    assert.ok(template.includes(`id="${id}"`), `the full-page gift form includes ${id}`);
  }
  for (const id of ['simulation-float-gift-catalog-error', 'simulation-float-gift-catalog-retry']) {
    assert.ok(script.includes(`id="${id}"`), `the floating gift form includes ${id}`);
  }

  const {ui, elements, requests, body, document} = loadSimulationUI({giftCatalogResponses: [
    new Error('network unavailable'),
    {gifts: [{id: 'rose-one', name: 'Rose', diamonds: 1, image_url: 'https://example.test/rose.png'}]},
  ]});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('simulation-gift-catalog-error').hidden, false);
  assert.equal(elements.get('simulation-float-gift-catalog-error').hidden, false);
  assert.equal(elements.get('simulation-gift-catalog-error-message').textContent,
    'No se pudo cargar el catálogo de regalos. Inténtalo de nuevo.');

  elements.get('simulation-gift').dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const pickerStatus = descendants(picker).find(node => node.getAttribute('role') === 'status');
  const pickerRetry = descendants(picker).find(node => node.id === 'simulation-gift-picker-retry');
  assert.equal(pickerStatus.textContent, 'No se pudo cargar el catálogo de regalos.');
  assert.equal(pickerRetry.hidden, false, 'the open picker offers a retry instead of an empty result');

  pickerRetry.dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.filter(request => request.url === '/gift-catalog').length, 2,
    'retry makes a second catalog request in the same UI instance');
  assert.equal(elements.get('simulation-gift-catalog-error').hidden, true);
  assert.equal(elements.get('simulation-float-gift-catalog-error').hidden, true);
  assert.equal(elements.get('simulation-gift').dataset.giftId, 'rose-one');
  assert.equal(elements.get('simulation-float-gift').dataset.giftId, 'rose-one');
  assert.equal(pickerRetry.hidden, true);
  assert.equal(picker.querySelectorAll('[role="option"]').length, 1,
    'the retry restores the catalog options without reloading the page');
  assert.equal(document.activeElement, descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo'),
    'successful picker retry moves focus to the search field');

  const inlineRetry = loadSimulationUI({giftCatalogResponses: [
    new Error('network unavailable'),
    {gifts: [{id: 'rose-one', name: 'Rose', diamonds: 1}]},
  ]});
  await new Promise(resolve => setImmediate(resolve));
  inlineRetry.elements.get('simulation-float-gift-catalog-retry').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(inlineRetry.document.activeElement, inlineRetry.elements.get('simulation-float-gift'),
    'successful inline retry returns focus to its matching gift trigger');
});

test('gift picker shows catalog art and diamond values and submits the chosen duplicate name ID', async () => {
  const {elements, requests, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const trigger = elements.get('simulation-gift');
  assert.equal(trigger.tagName, 'BUTTON');
  assert.equal(trigger.getAttribute('role'), 'combobox');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const search = descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo');
  assert.ok(search, 'the popover should have a distinct accessible search field');
  assert.equal(search.getAttribute('role'), 'combobox');
  assert.equal(search.getAttribute('aria-controls'), 'simulation-gift-options');
  assert.match(trigger.textContent, /Rose/, 'Regalo should continue to show the selected name');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 3, 'opening should show the full catalog');
  const options = picker.querySelectorAll('[role="option"]');
  assert.ok(descendants(options[2]).some(node => node.tagName === 'IMG' && node.src.endsWith('rose-five.png')));
  assert.ok(descendants(options[2]).some(node => node.textContent === '5 diamantes'));
  search.value = 'rOsE';
  search.dispatch('input');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 2, 'search should filter case-insensitively');
  search.value = '';
  search.dispatch('input');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 3, 'clearing search should restore the catalog');
  search.value = 'Rose';
  search.dispatch('input');
  search.dispatch('keydown', {key: 'ArrowDown'});
  search.dispatch('keydown', {key: 'ArrowDown'});
  search.dispatch('keydown', {key: 'Enter'});
  assert.match(trigger.textContent, /Rose/);
  assert.equal(trigger.dataset.giftId, 'rose-five');
  assert.ok(descendants(trigger).some(node => node.tagName === 'IMG' && node.src.endsWith('rose-five.png')),
    'selected gift artwork should remain visible in the trigger');
  assert.ok(descendants(trigger).some(node => node.textContent === '5 diamantes'));
  trigger.dispatch('click');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 3, 'clicking the selected field should reopen the full catalog');
  assert.equal(search.value, '', 'reopening should clear the previous search query');
  elements.get('simulation-form').onsubmit({preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve));
  const request = requests.find(item => item.url === '/simulation/events');
  assert.equal(JSON.parse(request.options.body).gift, 'Rose');
  assert.equal(JSON.parse(request.options.body).gift_id, 'rose-five');
});

test('floating simulator gift field uses the same complete visual catalog', async () => {
  const {elements, requests, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const trigger = elements.get('simulation-float-gift');
  assert.equal(trigger.tagName, 'BUTTON');
  assert.equal(trigger.getAttribute('role'), 'combobox');
  trigger.dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const search = descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo');
  assert.ok(search, 'the floating chat popover should reuse the accessible search control');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 3);
  assert.ok(descendants(picker.querySelectorAll('[role="option"]')[1]).some(node => node.textContent === '1 diamantes'));
  search.value = 'no existe';
  search.dispatch('input');
  const status = descendants(picker).find(node => node.getAttribute('role') === 'status');
  assert.ok(status, 'empty results should have an accessible status');
  assert.match(status.textContent, /No se encontraron regalos/i);
  search.dispatch('keydown', {key: 'Escape'});
  assert.equal(picker.hidden, true, 'Escape from search should close the picker');
  trigger.dispatch('click');
  search.value = 'Rose';
  search.dispatch('input');
  search.dispatch('keydown', {key: 'ArrowDown'});
  search.dispatch('keydown', {key: 'ArrowDown'});
  search.dispatch('keydown', {key: 'Enter'});
  assert.equal(trigger.dataset.giftId, 'rose-five');
  elements.get('simulation-float-form').onsubmit({preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve));
  const request = requests.find(item => item.url === '/simulation/events');
  assert.equal(JSON.parse(request.options.body).gift, 'Rose');
  assert.equal(JSON.parse(request.options.body).gift_id, 'rose-five');
});

test('gift picker opens the full catalog for the default value and Escape stays in the picker', async () => {
  const {elements, body} = loadSimulationUI();
  const input = elements.get('simulation-gift');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(input.dataset.giftId, 'rose-one', 'the default selection should resolve to its catalog identity');
  assert.ok(descendants(input).some(node => node.tagName === 'IMG'), 'the default selection should show its art');
  input.dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  assert.equal(picker.querySelectorAll('[role="option"]').length, 3, 'the default name should not filter the initial catalog');
  const keyEvent = {key: 'Escape', preventDefault: () => keyEvent.prevented = true,
    stopPropagation: () => keyEvent.stopped = true, prevented: false, stopped: false};
  descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo').dispatch('keydown', keyEvent);
  assert.equal(keyEvent.prevented, true);
  assert.equal(keyEvent.stopped, true);
  assert.equal(picker.hidden, true);
});

test('Tab from the gift search closes the picker and lets focus continue', async () => {
  const {elements, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const input = elements.get('simulation-gift');
  input.dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const search = descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo');
  const event = {key: 'Tab', preventDefault() { this.prevented = true; }};
  search.dispatch('keydown', event);
  assert.equal(picker.hidden, true);
  assert.equal(event.prevented, undefined, 'Tab should not be trapped by the picker');
});

test('ArrowUp starts at the final catalog item', async () => {
  const {elements, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const input = elements.get('simulation-gift');
  input.dispatch('click');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const search = descendants(picker).find(node => node.getAttribute('aria-label') === 'Buscar regalo');
  search.dispatch('keydown', {key: 'ArrowUp'});
  search.dispatch('keydown', {key: 'Enter'});
  assert.equal(input.dataset.giftId, 'rose-five');
  assert.equal(picker.hidden, true);
});
