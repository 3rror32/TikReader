const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const scripts = [], registered = new Map();
  const node = () => ({ isConnected: true, children: [], attrs: {}, append(child) { this.children.push(child); },
    replaceChildren() { this.children = []; }, setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; }, remove() { this.removed = true; } });
  const window = { OperatorViewRegistry: { get: key => registered.get(key) } };
  vm.runInNewContext(fs.readFileSync('web/static/optional_tools.js', 'utf8'), {
    window, document: { createElement: node, head: { append: script => scripts.push(script) } }
  });
  return { loader: window.OptionalTools, scripts, registered, pane: node() };
}

test('optional tools load once and retain successful registration', async () => {
  const { loader, scripts, registered, pane } = harness();
  const first = loader.load('minecraft', pane);
  assert.equal(loader.load('minecraft', pane), first);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, '/static/minecraft.js');
  registered.set('minecraft', {});
  pane.isConnected = false;
  scripts[0].onload();
  assert.equal(await first, true);
  assert.equal(loader.load('minecraft', pane), first);
  assert.equal(scripts.length, 1);
});

test('failed loading and missing registration offer an explicit retry', async () => {
  const { loader, scripts, pane } = harness();
  const first = loader.load('game-hotkeys', pane);
  scripts[0].onerror();
  assert.equal(await first, false);
  assert.equal(pane.children[1].textContent, 'Reintentar');
  pane.children[1].onclick();
  assert.equal(scripts.length, 2);
  scripts[1].onload();
  assert.equal(pane.children[0].textContent, 'No se pudo cargar la herramienta.');
  assert.equal(pane.attrs['aria-busy'], undefined);
});
