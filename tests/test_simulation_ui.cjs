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
  addEventListener() {}
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  focus() {}
  select() {}
  set innerHTML(value) { this._innerHTML = value; }
  get innerHTML() { return this._innerHTML || ''; }
}

function loadSimulationUI() {
  const elements = new Map();
  const body = new Element('body');
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
    addEventListener() {},
  };
  const window = {addEventListener() {}};
  const sandbox = {
    window,
    document,
    Element,
    ResizeObserver: class { observe() {} },
    AbortSignal,
    fetch: async () => ({json: async () => ({gifts: []})}),
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
  return {ui: window.SimulationUI, elements};
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
