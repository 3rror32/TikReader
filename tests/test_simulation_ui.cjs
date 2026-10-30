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
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  dispatch(name, event = {}) { for (const listener of this.listeners[name] || []) listener({target: this, preventDefault() {}, stopPropagation() {}, ...event}); }
  removeAttribute(name) { delete this.attributes[name]; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  querySelector() { return new Element(); }
  querySelectorAll(selector) { return selector.includes('option') ? descendants(this).filter(node => node.getAttribute('role') === 'option') : []; }
  getBoundingClientRect() { return {left: 20, top: 100, bottom: 134, width: 180}; }
  focus() {}
  select() {}
  set innerHTML(value) { this._innerHTML = value; }
  get innerHTML() { return this._innerHTML || ''; }
}

function loadSimulationUI() {
  const elements = new Map();
  const body = new Element('body');
  const documentListeners = {};
  const document = {
    hidden: true,
    body,
    createElement: tag => new Element(tag),
    getElementById(id) {
      if (!elements.has(id)) {
        const element = new Element();
        element.id = id;
        elements.set(id, element);
      }
      return elements.get(id);
    },
    querySelector: () => new Element(),
    querySelectorAll: () => [],
    addEventListener(name, listener) { (documentListeners[name] ||= []).push(listener); },
  };
  const window = {addEventListener() {}};
  const requests = [];
  const sandbox = {
    window,
    document,
    Element,
    ResizeObserver: class { observe() {} },
    AbortSignal,
    fetch: async (url, options = {}) => {
      requests.push({url, options});
      return {ok: true, json: async () => url === '/gift-catalog' ? {gifts: [
        {id: 'heart-ten', name: 'Heart', diamonds: 10, image_url: 'https://example.test/heart.png'},
        {id: 'rose-one', name: 'Rose', diamonds: 1, image_url: 'https://example.test/rose.png'},
        {id: 'rose-five', name: 'Rose', diamonds: 5, image_url: 'https://example.test/rose-five.png'},
      ]} : {active: true, generation: 1, instance: 'ui-test'}};
    },
    setInterval() {},
    addEventListener() {},
    matchMedia: () => ({matches: false}),
    requestAnimationFrame() {},
    sessionStorage: {getItem: () => null, setItem() {}},
    localStorage: {getItem: () => null, setItem() {}},
    innerWidth: 1200,
    innerHeight: 800,
    console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/static/simulation.js'), 'utf8'), sandbox);
  return {ui: window.SimulationUI, elements, requests, body};
}

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

test('gift picker shows catalog art and diamond values and submits the chosen duplicate name ID', async () => {
  const {elements, requests, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const input = elements.get('simulation-gift');
  input.value = 'Rose';
  input.dispatch('focus');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  const options = picker.children;
  assert.equal(options.length, 3, 'focusing with default Rose should show the full catalog');
  assert.ok(descendants(options[2]).some(node => node.tagName === 'IMG' && node.src.endsWith('rose-five.png')));
  assert.ok(descendants(options[2]).some(node => node.textContent === '5 diamantes'));
  input.dispatch('input');
  assert.equal(picker.children.length, 2, 'typing Rose should filter the catalog');
  input.dispatch('keydown', {key: 'ArrowDown'});
  input.dispatch('keydown', {key: 'ArrowDown'});
  input.dispatch('keydown', {key: 'Enter'});
  assert.equal(input.value, 'Rose');
  assert.equal(input.dataset.giftId, 'rose-five');
  const selection = elements.get('simulation-gift-selection');
  assert.equal(selection.hidden, false, 'selected gift artwork and value should remain visible');
  assert.ok(descendants(selection).some(node => node.textContent === '5 diamantes'));
  input.dispatch('click');
  assert.equal(picker.children.length, 3, 'clicking the selected field should reopen the full catalog');
  elements.get('simulation-form').onsubmit({preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve));
  const request = requests.find(item => item.url === '/simulation/events');
  assert.equal(JSON.parse(request.options.body).gift_id, 'rose-five');
});

test('floating simulator gift field uses the same complete visual catalog', async () => {
  const {elements, body} = loadSimulationUI();
  elements.get('simulation-float-gift').value = 'Rose';
  await new Promise(resolve => setImmediate(resolve));
  elements.get('simulation-float-gift').dispatch('focus');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  assert.equal(picker.children.length, 3);
  assert.ok(descendants(picker.children[1]).some(node => node.textContent === '1 diamantes'));
});

test('gift picker opens the full catalog for the default value and Escape stays in the picker', async () => {
  const {elements, body} = loadSimulationUI();
  const input = elements.get('simulation-gift');
  input.value = 'Rose';
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(input.dataset.giftId, 'rose-one', 'the default selection should resolve to its catalog identity');
  assert.equal(elements.get('simulation-gift-selection').hidden, false, 'the default selection should show its art and value');
  input.dispatch('focus');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  assert.equal(picker.children.length, 3, 'the default name should not filter the initial catalog');
  const keyEvent = {key: 'Escape', preventDefault: () => keyEvent.prevented = true,
    stopPropagation: () => keyEvent.stopped = true, prevented: false, stopped: false};
  input.dispatch('keydown', keyEvent);
  assert.equal(keyEvent.prevented, true);
  assert.equal(keyEvent.stopped, true);
  assert.equal(picker.hidden, true);
});

test('ArrowUp starts at the final catalog item', async () => {
  const {elements, body} = loadSimulationUI();
  await new Promise(resolve => setImmediate(resolve));
  const input = elements.get('simulation-gift');
  input.dispatch('focus');
  const picker = descendants(body).find(node => node.id === 'simulation-gift-picker');
  input.dispatch('keydown', {key: 'ArrowUp'});
  input.dispatch('keydown', {key: 'Enter'});
  assert.equal(input.dataset.giftId, 'rose-five');
  assert.equal(picker.hidden, true);
});
