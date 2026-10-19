const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(saved = 'false') {
  const nodes = [], storage = new Map([['tikreader.concentration', saved]]);
  const element = tag => {
    const classes = new Set();
    const node = {tag, children: [], attributes: {}, hidden: false, textContent: '',
      classList: {toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name)},
      append(...items) { this.children.push(...items); }, after(item) { nodes.push(item); },
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren(...items) { this.children = items; }, click() { this.onclick?.(); }};
    nodes.push(node); return node;
  };
  const roots = new Map(), body = element('body');
  const get = name => {
    const existing = nodes.find(node => node.id === name) || roots.get(name);
    if (existing) return existing;
    const node = element('div'); roots.set(name, node); return node;
  };
  let snapshot = {current: null, pending: [], status: 'Voz activa · cola: 0'}, refresh;
  const document = {body, createElement: element, getElementById: get, querySelector: get};
  const window = {Studio: {voiceSnapshot: () => snapshot}, Notifications: {show() {}}};
  vm.runInNewContext(fs.readFileSync('web/static/live_experience.js', 'utf8'), {
    window, document, localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    MutationObserver: class {constructor(callback) { refresh = callback; } observe() {}}});
  return {get, body, storage, set(value) { snapshot = value; refresh(); }};
}

test('focus preserves preference and offers a reversible gifts disclosure', () => {
  const {get, body, storage} = setup('true');
  const gifts = get('focus-gifts-toggle');
  assert.equal(gifts.hidden, false);
  gifts.click();
  assert.equal(body.classList.contains('focus-show-gifts'), true);
  assert.equal(gifts.attributes['aria-expanded'], 'true');
  get('concentration-toggle').click();
  assert.equal(body.classList.contains('concentration'), false);
  assert.equal(body.classList.contains('focus-show-gifts'), false);
  assert.equal(gifts.hidden, true);
  assert.equal(storage.get('tikreader.concentration'), 'false');
});

test('voice summary remains outside collapsed management and reflects safe current, next and status', () => {
  const ui = setup();
  ui.set({current: '<img onerror=alert(1)>', pending: [{id: 1, text: 'Siguiente mensaje'}], status: 'Voz pausada · cola: 1'});
  assert.equal(ui.get('live-voice-current').textContent, '<img onerror=alert(1)>');
  assert.equal(ui.get('live-voice-next').textContent, 'Siguiente mensaje');
  assert.equal(ui.get('live-voice-count').textContent, '1 pendiente');
  assert.equal(ui.get('live-voice-status').textContent, 'Voz pausada · cola: 1');
  ui.set({current: null, pending: [], status: 'Error de voz: no disponible'});
  assert.equal(ui.get('live-voice-current').textContent, 'Sin lectura en curso');
  assert.equal(ui.get('live-voice-next').textContent, 'Sin comentarios pendientes');
  assert.equal(ui.get('live-voice-count').textContent, '0 pendientes');
});
